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

        const sales_order_type = record.Type.SALES_ORDER;
        // Saved Searches
        const food_item_saved_search_id = 'customsearch_bpc_ab_pet_food_search';
        const pet_saved_search_id = 'customsearch_bpc_pet_search';

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
                const pet_id = pet.id;
                const customer_id = pet.values[pet_customer_field]?.value;
                const pet_name = pet.values[pet_name_field];
                const pet_weight = parseFloat(pet.values[pet_weight_field]) || 0;

                if (!customer_id || !pet_name) {
                        log.error('Missing the following fields: ', { pet_id, customer_id, pet_name });
                        return;
                }

                try {
                        // Calculate the amount of food needed
                        const daily_cups = 0.5 * (pet_weight / 5);
                        const monthly_cups = Math.ceil(daily_cups * 30);

                        // Create a sales order
                        const sales_order = record.create({
                                type: sales_order_type,
                                isDynamic: true
                        });

                        sales_order.setValue({
                                fieldId: 'entity',
                                value: customer_id
                        });

                        // Set the date of the order
                        sales_order.selectNewLine({ sublistId: 'item' });
                        sales_order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: 123 }); // <-- Reemplazar con tu ID real de producto
                        sales_order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: monthly_cups });
                        sales_order.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'description',
                                value: `Instrucctions for ${pet_name}: ${daily_cups.toFixed(1)} cups per day`
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
                        let last_order_date = pet_record.getValue({ fieldId: pet_last_order_date_field });
                        pet_record.setValue({
                                fieldId: pet_last_order_date_field,
                                value: format.format({
                                        value: last_order_date,
                                        type: format.Type.DATE
                                })
                        });
                        pet_record.save();

                } catch (e) {
                        log.error('Error when creating an order or updating a pet record', { pet_id, error: e });
                }
        }

        return {
                getInputData: getInputData,
                map: map
        };
});