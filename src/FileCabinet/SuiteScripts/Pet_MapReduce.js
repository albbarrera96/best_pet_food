/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log', 'N/format'], function(search, record, log, format) {

        // Record types and fields
        const pet_record_type = 'customrecord_bpc_bf_pet';

        // Pet Record Fields
        const pet_customer_field = 'custrecord_bpc_bf_pet_cust';
        const pet_name_field = 'name';
        const pet_weight_field = 'custrecord_bpc_current_weight_kg';
        const pet_last_order_date_field = 'custrecord_bpc_last_order_date';
        const pet_anniversary_date_field = 'custrecord_bpc_anniversary_date';
        const pet_age_in_months_field = 'custrecord_bpc_age_in_months';
        const pet_status_field = 'custrecord_bpc_pet_status';
        const pet_breed_size_field = 'custrecord_bpc_pet_breed_size';

        function getInputData() {
                // Create a search to find pets that need to be ordered
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
                                pet_last_order_date_field,
                                pet_anniversary_date_field,
                                pet_age_in_months_field,
                                pet_status_field
                        ]
                });
        }

        function map(context) {
                const pet = JSON.parse(context.value);
                const pet_id = pet.values.id;
                const customer_id = pet.values.customer.value;
                const pet_name = pet.values.name;
                const pet_weight = parseFloat(pet.values[pet_weight_field]) || 0;
                const pet_age_in_months = parseInt(pet.values[pet_age_in_months_field]) || 0;
                const breed_size = pet.values[pet_breed_size_field];
                const pet_type = pet.values['custrecord_bpc_bf_type'];

                if (!customer_id || !pet_name || !pet_type) {
                        log.error('Missing required fields', { pet_id, customer_id, pet_name, pet_type });
                        return;
                }

                try {
                        // Determine food type and stage
                        let food_stage;
                        if (pet_type === 'Dog') {
                                if (pet_age_in_months >= 9 && pet_age_in_months <= 24) {
                                        food_stage = 'Puppy';
                                } else if (pet_age_in_months > 24) {
                                        food_stage = 'Adult';
                                } else {
                                        log.error('Invalid pet age for dog', { pet_id, pet_age_in_months });
                                        return;
                                }
                        } else if (pet_type === 'Cat') {
                                if (pet_age_in_months >= 12 && pet_age_in_months <= 24) {
                                        food_stage = 'Kitten';
                                } else if (pet_age_in_months > 24) {
                                        food_stage = 'Adult';
                                } else {
                                        log.error('Invalid pet age for cat', { pet_id, pet_age_in_months });
                                        return;
                                }
                        } else {
                                log.error('Unknown pet type', { pet_id, pet_type });
                                return;
                        }

                        if (!breed_size) {
                                log.error('Invalid breed size', { pet_id, breed_size });
                                return;
                        }

                        // Fetch appropriate food item from saved search
                        const food_item = getFoodItem(food_stage, breed_size);

                        if (!food_item) {
                                log.error('No matching food item found', { pet_id, food_stage, breed_size });
                                return;
                        }

                        const food_item_id = food_item.getValue('internalid');
                        const food_bag_size = parseInt(food_item.getValue('custitem_bpc_bf_cups')) || 0;

                        // Calculate daily and monthly food requirements
                        const daily_cups = food_stage === 'Puppy' || food_stage === 'Kitten'
                            ? 0.5 + (0.5 * (pet_weight / 5))
                            : 0.5 * (pet_weight / 5);
                        const monthly_cups = Math.ceil(daily_cups * 30);
                        const bags_needed = Math.ceil(monthly_cups / food_bag_size);

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

        function getFoodItem(food_stage, breed_size) {
                const food_search = search.create({
                        type: "inventoryitem",
                        filters: [
                                ["type", "anyof", "InvtPart"],
                                "AND",
                                ["class", "anyof", "34"],
                                "AND",
                                ["custitem_bpc_bf_cups", "anyof", "1", "2", "3"],
                                "AND",
                                ["custitem_bpc_food_breed_size", "anyof", "1", "2", "3"]
                        ],
                        columns: [
                                search.createColumn({ name: "internalid", label: "Internal ID" }),
                                search.createColumn({ name: "custitem_bpc_bf_cups", label: "Bag Size (Cups)" }),
                                search.createColumn({ name: "custitem_bpc_bf_stage", label: "For Stage" }),
                                search.createColumn({ name: "custitem_bpc_food_breed_size", label: "Breed Size" })
                        ]
                });

                return food_search.run().getRange({ start: 0, end: 100 }).find(item => {
                        return item.getValue('custitem_bpc_bf_stage') === food_stage &&
                            item.getValue('custitem_bpc_food_breed_size') === breed_size;
                });
        }

        return {
                getInputData: getInputData,
                map: map
        };
});