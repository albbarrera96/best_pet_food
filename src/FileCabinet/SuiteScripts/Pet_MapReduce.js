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
                const breed_size = pet.values[pet_breed_size_field] || null;
                const pet_type = pet.values[pet_type_field]?.value || null;
                const pet_type_text = pet.values[pet_type_field]?.text || null;
                const last_order_date = pet.values[pet_last_order_date_field];
                const anniversary_date = pet.values[pet_anniversary_date_field];

                const pet_stage = getPetStage(pet_type_text, pet_age_in_months);
                const food_requirements = getFoodBagBreakdown(pet_weight_lbs);

                log.debug('Pet and Food Requirements', {
                        pet_id,
                        customer_id,
                        pet_name,
                        pet_weight_kg,
                        pet_weight_lbs,
                        pet_age_in_months,
                        breed_size,
                        pet_type,
                        last_order_date,
                        anniversary_date,
                        pet_stage,
                        food_requirements
                });

                if (!pet_type || !breed_size || !pet_stage) return;

                const food_search = search.create({
                        type: 'inventoryitem',
                        filters: [
                                ['custitem_bpc_animal', 'anyof', pet_type],
                                'AND',
                                ['custitem_bpc_food_breed_size', 'anyof', breed_size],
                                'AND',
                                ['custitem_bpc_bf_stage', 'anyof', pet_stage]
                        ],
                        columns: [
                                'internalid',
                                food_breed_size_field,
                                food_animal_type_field,
                                food_stage_field,
                                food_size_in_cups_field
                        ]
                });
        }

        return {
                getInputData,
                map
        };
});
