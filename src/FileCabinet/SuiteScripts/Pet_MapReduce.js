/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log', 'N/format'], function(search, record, log, format) {

        const pet_record_type = 'customrecord_bpc_bf_pet';
        const pet_customer_field = 'custrecord_bpc_bf_pet_cust';
        const pet_name_field = 'name';
        const pet_weight_field = 'custrecord_bpc_current_weight_kg';
        const pet_type_field = 'custrecord_bpc_bf_type';
        const pet_last_order_date_field = 'custrecord_bpc_last_order_date';
        const pet_anniversary_date_field = 'custrecord_bpc_anniversary_date';
        const pet_age_in_months_field = 'custrecord_bpc_age_in_months';
        const pet_breed_size_field = 'custrecord_bpc_pet_breed_size';
        const pet_breed_size_index = '';
        const pet_breed_expected_weight_field = 'custrecord_bpc_expected_adult_weight';
        const pet_breed_expected_adult_age_field = 'custrecord_bpc_breed_expected_adult_age';

        const food_breed_size_field = 'custitem_bpc_food_breed_size';
        const food_animal_type_field = 'custitem_bpc_animal';
        const food_stage_field = 'custitem_bpc_bf_stage';
        const food_size_in_cups_field = 'custitem_bpc_bf_cups';

        const WELCOME_BOX = 914;

        function getInputData() {
                return search.create({
                        type: pet_record_type,
                        filters: [
                                ['custrecord_bpc_last_order_date', 'onorbefore', 'daysago30'],
                                'OR',
                                ['custrecord_bpc_last_order_date', 'isempty', '']
                        ],
                        columns: [
                                'internalid',
                                pet_customer_field,
                                pet_name_field,
                                pet_weight_field,
                                pet_type_field,
                                pet_last_order_date_field,
                                pet_anniversary_date_field,
                                pet_age_in_months_field,
                                pet_breed_size_field,
                                pet_breed_expected_weight_field,
                        ]
                });
        }

        function getPetStage(pet_type_text, age_in_months) {
                if (pet_type_text === 'Dog' && age_in_months <= 24) return 'Kitten/Puppy';
                if (pet_type_text === 'Dog' && age_in_months > 24) return 'Adult';
                if (pet_type_text === 'Cat' && age_in_months <= 24) return 'Kitten/Puppy';
                if (pet_type_text === 'Cat' && age_in_months > 6) return 'Adult';
                return null;
        }

        function getFoodBagBreakdown(pet_weight_lbs, pet_stage) {
                // Calculate daily cups based on pet stage
                const daily_cups = pet_stage === 'Kitten/Puppy'
                    ? 0.5 + (0.5 * (pet_weight_lbs / 5))
                    : 0.5 * (pet_weight_lbs / 5);

                const monthly_cups = Math.ceil(daily_cups * 30);

                const bag_sizes = [20, 10, 5];
                const bag_counts = { 20: 0, 10: 0, 5: 0 };
                let remaining_cups = monthly_cups;

                for (let size of bag_sizes) {
                        if (remaining_cups <= 0) break;
                        const count = Math.floor(remaining_cups / size);
                        if (count > 0) {
                                bag_counts[size] = count;
                                remaining_cups -= count * size;
                        }
                }

                if (remaining_cups > 0) {
                        for (let size of [...bag_sizes].reverse()) {
                                if (size >= remaining_cups) {
                                        bag_counts[size]++;
                                        break;
                                }
                        }
                }

                return {
                        monthly_cups,
                        bags: bag_counts
                };
        }

        function map(context) {
                const pet = JSON.parse(context.value);
                const pet_id = pet.id;
                const customer_id = pet.values[pet_customer_field]?.value;
                const pet_name = pet.values[pet_name_field];
                const pet_weight_kg = parseFloat(pet.values[pet_weight_field]) || 0;
                const pet_weight_lbs = Math.ceil(pet_weight_kg * 2.20462);
                const pet_age_in_months = parseInt(pet.values[pet_age_in_months_field]) || 0;
                const breed_size = pet.values[pet_breed_size_field].value || null;
                const pet_type = pet.values[pet_type_field]?.value || null;
                const pet_type_text = pet.values[pet_type_field]?.text || null;
                const last_order_date = pet.values[pet_last_order_date_field];
                const anniversary_date = pet.values[pet_anniversary_date_field];

                const pet_stage = getPetStage(pet_type_text, pet_age_in_months);
                const food_requirements = getFoodBagBreakdown(pet_weight_lbs);

                log.debug('Pet and Food Requirements', pet);

                if (!pet_type || !breed_size || !pet_stage) return;

                const food_search = search.create({
                        type: 'inventoryitem',
                        filters: [
                                ["type","anyof","InvtPart"],
                                "AND",
                                ["class","anyof","34"],
                                "AND",
                                ["custitem_bpc_bf_cups","anyof","1","2","3"],
                                "AND",
                                ["custitem_bpc_food_breed_size","anyof", breed_size],
                                "AND",
                                ["custitem_bpc_animal","anyof",""],
                                "AND",
                                ["custitem_bpc_bf_stage","anyof",""]
                        ],
                        columns: [
                                'internalid',
                                food_breed_size_field,
                                food_animal_type_field,
                                food_stage_field,
                                food_size_in_cups_field
                        ]
                });

                const bagSizeToItemMap = {};

                food_search.run().each(function(result) {
                        const item_id = result.getValue({ name: 'internalid' });
                        const item_cup_size = parseFloat(result.getValue({ name: food_size_in_cups_field })) || 0;

                        // Guarda el producto que corresponde a cada tamaño de bolsa
                        if ([5, 10, 20].includes(item_cup_size)) {
                                bagSizeToItemMap[item_cup_size] = item_id;
                        }

                        return true;
                });

                const { bags } = food_requirements;

                const hasBagsToOrder = Object.keys(bags).some(size => bags[size] > 0 && bagSizeToItemMap[size]);

                if (hasBagsToOrder) {
                        try {
                                const order = record.create({
                                        type: record.Type.SALES_ORDER,
                                        isDynamic: true
                                });

                                order.setValue({
                                        fieldId: 'entity',
                                        value: customer_id
                                });

                                const daily_cups = (food_requirements.monthly_cups / 30).toFixed(1);
                                const feeding_instruction = `Feeding Instructions for ${pet_name}: Feed approximately ${daily_cups} cups per day.`;

                                order.selectNewLine({ sublistId: 'item' });
                                order.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'item',
                                        value: null
                                });
                                order.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'description',
                                        value: feeding_instruction
                                });
                                order.commitLine({ sublistId: 'item' });

                                for (let size of [20, 10, 5]) {
                                        const qty = bags[size];
                                        const item_id = bagSizeToItemMap[size];

                                        if (!qty || !item_id) continue;

                                        order.selectNewLine({ sublistId: 'item' });
                                        order.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'item',
                                                value: item_id
                                        });
                                        order.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'quantity',
                                                value: qty
                                        });
                                        order.commitLine({ sublistId: 'item' });
                                }

                                const order_id = order.save();
                                log.audit('Orden de venta creada', { order_id, pet_name, customer_id });

                        } catch (e) {
                                log.error('Error al crear orden de venta', e);
                        }
                }

        }

        return {
                getInputData,
                map
        };
});
