/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log', 'N/format'], function(search, record, log, format) {

        /* dog.age_in_months = 0-6; food.breed_size = dog.breed_size && food.stage */
        /* cat dog.age_in_months = 0-6; food.breed_size = cat.breed_size && food.stage */

        /* dog.age_in_months = 9-24; food.breed_size = dog.breed_size && food.stage */
        /* cat dog.age_in_months = 12-24; food.breed_size = cat.breed_size && */

        /* dog.age => adult_expected_age; food.stage = adult && food.breed_size = dog.breed_size */
        /* cat age => adult_expected_age; food.stage = adult && food.breed_size = cat.breed_size */

        /* Pets should get ½ cup/day for every 5 lbs of weight (pet.weight is in kg) */

        /*      ●   All dogs less than adult age should have the weight auto updated monthly
                ○	At half of their adult age expect the dog to be 75% of their expected adult weight
                ○	At their adult age expect the dog to be their adult weight
                ●	All cats less than 2 years should have their weight auto updated monthly
                ○	Find their adult age, and their adult weight
                ○	They should be expected to have even growth from birth to their adult age and weight
         */

        /*
                ●	All pets with last order dates a month ago or older should have new orders created
                ●	The pet records which have had orders created should have updated last order dates of today
        **/

        const pet_record_type = 'customrecord_bpc_bf_pet';
        const sales_order_type = record.Type.SALES_ORDER;
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

        function map(context) {
                function map(context) {
                        const pet = JSON.parse(context.value);
                        const pet_id = pet.id;
                        const customer_id = pet.values[pet_customer_field]?.value;
                        const pet_name = pet.values[pet_name_field];
                        const pet_weight_kg = parseFloat(pet.values[pet_weight_field]) || 0;
                        const pet_weight_lbs = pet_weight_kg * 2.20462; // Convert kg to lbs
                        const pet_age_in_months = parseInt(pet.values[pet_age_in_months_field]) || 0;
                        const breed_size = pet.values[pet_breed_size_field];
                        const pet_type = pet.values[pet_type_field];
                        const last_order_date = pet.values[pet_last_order_date_field];
                        const anniversary_date = pet.values[pet_anniversary_date_field];

                        if (!customer_id || !pet_name || !pet_type) {
                                log.error('Missing required fields', { pet_id, customer_id, pet_name, pet_type });
                                return;
                        }

                        try {
                                // Determine food type and stage
                                let food_stage;
                                if (pet_type === 'Dog') {
                                        if (pet_age_in_months >= 0 && pet_age_in_months <= 6) {
                                                food_stage = 'Puppy';
                                        } else if (pet_age_in_months >= 9 && pet_age_in_months <= 24) {
                                                food_stage = 'Puppy';
                                        } else if (pet_age_in_months > 24) {
                                                food_stage = 'Adult';
                                        }
                                } else if (pet_type === 'Cat') {
                                        if (pet_age_in_months >= 0 && pet_age_in_months <= 6) {
                                                food_stage = 'Kitten';
                                        } else if (pet_age_in_months >= 12 && pet_age_in_months <= 24) {
                                                food_stage = 'Kitten';
                                        } else if (pet_age_in_months > 24) {
                                                food_stage = 'Adult';
                                        }
                                }

                                if (!food_stage || !breed_size) {
                                        log.error('Invalid food stage or breed size', { pet_id, food_stage, breed_size });
                                        return;
                                }

                                // Fetch appropriate food item
                                const food_item = getFoodItem(food_stage, breed_size);
                                if (!food_item) {
                                        log.error('No matching food item found', { pet_id, food_stage, breed_size });
                                        return;
                                }

                                const food_item_id = food_item.getValue('internalid');
                                const food_bag_size = parseInt(food_item.getValue('custitem_bpc_bf_cups')) || 0;

                                // Calculate daily and monthly food requirements
                                const daily_cups = food_stage === 'Puppy' || food_stage === 'Kitten'
                                    ? 0.5 + (0.5 * (pet_weight_lbs / 5))
                                    : 0.5 * (pet_weight_lbs / 5);
                                const monthly_cups = Math.ceil(daily_cups * 30);
                                const bags_needed = Math.ceil(monthly_cups / food_bag_size);

                                // Update weight for growing pets
                                if (pet_type === 'Dog' && pet_age_in_months < 24) {
                                        const adult_weight = getAdultWeight(pet_id);
                                        const updated_weight = pet_age_in_months <= 12
                                            ? adult_weight * 0.75
                                            : adult_weight;
                                        updatePetWeight(pet_id, updated_weight);
                                } else if (pet_type === 'Cat' && pet_age_in_months < 24) {
                                        const adult_weight = getAdultWeight(pet_id);
                                        const updated_weight = (adult_weight / 24) * pet_age_in_months;
                                        updatePetWeight(pet_id, updated_weight);
                                }

                                // Create sales order
                                const sales_order = record.create({
                                        type: sales_order_type,
                                        isDynamic: true
                                });

                                sales_order.setValue({
                                        fieldId: 'entity',
                                        value: customer_id
                                });

                                sales_order.setValue({
                                        fieldId: 'memo',
                                        value: `Auto-generated order for ${pet_name}`
                                });

                                // Add food items
                                sales_order.selectNewLine({ sublistId: 'item' });
                                sales_order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: food_item_id });
                                sales_order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: bags_needed });
                                sales_order.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'description',
                                        value: `Feeding instructions for ${pet_name}: ${daily_cups.toFixed(1)} cups/day`
                                });
                                sales_order.commitLine({ sublistId: 'item' });

                                // Add welcome box for first-time orders
                                if (!last_order_date) {
                                        sales_order.selectNewLine({ sublistId: 'item' });
                                        sales_order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: WELCOME_BOX });
                                        sales_order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
                                        sales_order.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'description',
                                                value: `Welcome Box for ${pet_name}`
                                        });
                                        sales_order.commitLine({ sublistId: 'item' });
                                }

                                const sales_order_id = sales_order.save();

                                log.audit('Sales order created successfully', {
                                        sales_order_id,
                                        pet_id,
                                        customer_id
                                });

                                // Update the pet record with the last order date
                                const pet_record = record.load({ type: pet_record_type, id: pet_id });
                                pet_record.setValue({
                                        fieldId: pet_last_order_date_field,
                                        value: format.format({
                                                value: new Date(),
                                                type: format.Type.DATE
                                        })
                                });
                                pet_record.save();

                        } catch (e) {
                                log.error('Error when creating an order or updating a pet record', { pet_id, error: e });
                        }
                }

                function getFoodItem(food_stage, breed_size, pet_type) {
                        const food_search = search.create({
                                type: "inventoryitem",
                                filters: [
                                        ["type", "anyof", "InvtPart"],
                                        "AND",
                                        ["custitem_bpc_bf_stage", "is", food_stage],
                                        "AND",
                                        ["custitem_bpc_food_breed_size", "is", breed_size],
                                        "AND",
                                        ["custitem_bpc_pet_type", "is", pet_type]
                                ],
                                columns: [
                                        search.createColumn({ name: "internalid" }),
                                        search.createColumn({ name: "custitem_bpc_bf_cups" })
                                ]
                        });

                        return food_search.run().getRange({ start: 0, end: 1 })[0];
                }

                function getAdultWeight(pet_id) {
                        try {
                                const pet_record = record.load({
                                        type: pet_record_type,
                                        id: pet_id
                                });

                                const adult_weight = pet_record.getValue({
                                        fieldId: pet_breed_expected_weight_field
                                });

                                if (!adult_weight) {
                                        log.error('Missing expected adult weight', { pet_id });
                                        return null;
                                }

                                return parseFloat(adult_weight);
                        } catch (e) {
                                log.error('Error fetching adult weight', { pet_id, error: e });
                                return null;
                        }
                }

                function updatePetWeight(pet_id, weight) {
                        const pet_record = record.load({ type: pet_record_type, id: pet_id });
                        pet_record.setValue({ fieldId: pet_weight_field, value: weight });
                        pet_record.save();
                }
        }
        return {
                getInputData,
                map
        };
});
