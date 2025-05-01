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
        const pet_breed_expected_weight_field = 'custrecord_bpc_expected_adult_weight';

        function getInputData() {
                return search.create({
                        type: pet_record_type,
                        filters: [
                                /* Comentado temporalmente mientras se prueba el script
                                ['custrecord_bpc_last_order_date', 'onorbefore', 'daysago30'],
                                'OR',
                                ['custrecord_bpc_last_order_date', 'isempty', '']
                                */
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

        function getFoodItems() {
                const foodSearch = search.create({
                        type: "inventoryitem",
                        filters: [
                                ["type", "anyof", "InvtPart"],
                                "AND",
                                ["class", "anyof", "34"],
                                "AND",
                                ["custitem_bpc_bf_cups", "anyof", "1", "2", "3"],
                                "AND",
                                ["custitem_bpc_food_breed_size", "anyof", "1", "2", "3"],
                                "AND",
                                ["custitem_bpc_animal", "anyof", "1", "2"],
                                "AND",
                                ["custitem_bpc_bf_stage", "anyof", "1", "2"]
                        ],
                        columns: [
                                "internalid",
                                "itemid",
                                "displayname",
                                "salesdescription",
                                "type",
                                "baseprice",
                                "custitem_bpc_bf_cups",
                                "custitem_bpc_animal",
                                "custitem_bpc_bf_stage",
                                "custitem_bpc_food_breed_size"
                        ]
                });

                const results = [];
                foodSearch.run().each(function(result) {
                        results.push({
                                id: result.id,
                                itemid: result.getValue({ name: 'itemid' }),
                                cups: result.getValue({ name: 'custitem_bpc_bf_cups' }),
                                animal: result.getValue({ name: 'custitem_bpc_animal' }),
                                stage: result.getValue({ name: 'custitem_bpc_bf_stage' }),
                                breed_size: result.getValue({ name: 'custitem_bpc_food_breed_size' })
                        });
                        return true;
                });

                return results;
        }

        function map(context) {
                const pet = JSON.parse(context.value);
                const pet_id = pet.id;
                const customer_id = pet.values[pet_customer_field]?.value;
                const pet_name = pet.values[pet_name_field];
                const pet_weight_kg = parseFloat(pet.values[pet_weight_field]) || 0;
                const pet_weight_lbs = Math.ceil(pet_weight_kg * 2.20462);
                const pet_age_in_months = parseInt(pet.values[pet_age_in_months_field]) || 0;
                const breed_size = pet.values[pet_breed_size_field] || null;
                const pet_type = pet.values[pet_type_field]?.value || null;
                const pet_type_text = pet.values[pet_type_field]?.text || null;

                const pet_stage = getPetStage(pet_type_text, pet_age_in_months);
                const food_requirements = getFoodBagBreakdown(pet_weight_lbs, pet_stage);

                const breedSizeMap = {
                        'Small': 1,
                        'Medium': 2,
                        'Large': 3
                };

                const stageMap = {
                        'Kitten/Puppy': 1,
                        'Adult': 2
                };

                const breed_size_id = String(breedSizeMap[breed_size]) || null;
                const pet_stage_id = String(stageMap[pet_stage]) || null;

                if (!pet_type || !breed_size || !pet_stage) return;

                const foodItems = getFoodItems();

                const matchingItems = foodItems.filter(item =>
                    item.animal === pet_type &&
                    item.stage === pet_stage_id &&
                    item.breed_size === breed_size_id
                );

                if (!matchingItems.length || !customer_id) return;

                const cupSizeMap = {
                        5: '1',
                        10: '2',
                        20: '3'
                };

                const itemsByCups = {};
                for (let item of matchingItems) {
                        if (!itemsByCups[item.cups]) {
                                itemsByCups[item.cups] = item;
                        }
                }

                log.debug('itemsByCups', { itemsByCups, food_requirements });

                const hasValidItems = Object.keys(food_requirements.bags).some(size => {
                        const cupsId = cupSizeMap[size];
                        return food_requirements.bags[size] > 0 && itemsByCups[cupsId];
                });

                if (!hasValidItems) {
                        log.audit('No matching items found for any bag size', { pet_id, customer_id });
                        return;
                }

                const salesOrder = record.create({
                        type: record.Type.SALES_ORDER,
                        isDynamic: true
                });

                salesOrder.setValue({
                        fieldId: 'entity',
                        value: customer_id
                });

                salesOrder.setValue({
                        fieldId: 'custbody_sales_order_pet', // este es el campo correcto que debe establecer el ID de la mascota
                        value: pet_id
                });

                const bag_sizes = [20, 10, 5];

                for (let size of bag_sizes) {
                        const count = food_requirements.bags[size];
                        const cupsId = cupSizeMap[size];
                        const item = itemsByCups[cupsId];
                        if (count > 0 && item) {
                                salesOrder.selectNewLine({ sublistId: 'item' });
                                salesOrder.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'item',
                                        value: item.id
                                });
                                salesOrder.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'quantity',
                                        value: count
                                });
                                salesOrder.commitLine({ sublistId: 'item' });
                        }
                }

                const orderId = salesOrder.save();
                log.audit('Sales Order Created', { pet_id, customer_id, orderId });

                const today = new Date();
                const todayFormatted = format.format({
                        value: today,
                        type: format.Type.DATE
                });

                record.submitFields({
                        type: pet_record_type,
                        id: pet_id,
                        values: {
                                [pet_last_order_date_field]: todayFormatted
                        }
                });
        }

        return {
                getInputData,
                map
        };
});