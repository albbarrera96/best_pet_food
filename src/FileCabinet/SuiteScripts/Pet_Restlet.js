/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(["N/scriptTypes/restlet", "N/search", "N/log", "N/record", "N/format"], function(restlet, search, log, record, format) {

        const pet_record_type = 'customrecord_bpc_bf_pet';

        // Pet Record Fields
        const pet_name_field = 'name';
        const pet_type_field = 'custrecord_bpc_bf_type';
        const pet_breed_field = 'custrecord_bpc_bf_pet_breed';
        const pet_customer_field = 'custrecord_bpc_bf_pet_cust';
        const pet_birth_date_field = 'custrecord_bpc_birth_date';
        const pet_weight_field = 'custrecord_bpc_current_weight_kg';
        const pet_anniversary_field = 'custrecord_bpc_anniversary_date';
        const pet_status_field = 'custrecord_bpc_pet_status';

        // Customer Record Fields
        const customer_first_name_field = 'firstname';
        const customer_last_name_field = 'lastname';
        const customer_email_field = 'email';

        const get = (requestData) => {
                try {
                        const pet_id = requestData.pet_id;
                        if (!pet_id) {

                                return restlet.createResponse({
                                        content: JSON.stringify({ success: false, message: 'Pet ID is required' }),
                                        contentType: "application/json"
                                });
                        }

                        const pet_record = record.load({
                                type: pet_record_type,
                                id: pet_id
                        });
                        const customer_record = record.load({
                                type: record.Type.CUSTOMER,
                                id: pet_record.getValue({ fieldId: pet_customer_field })
                        });

                        const customer_id = pet_record.getValue({ fieldId: pet_customer_field });

                        if (!customer_id || !customer_record) {
                                return restlet.createResponse({
                                        content: JSON.stringify({ success: false, message: "Customer ID is required or customer doesn't not exist" }),
                                        contentType: "application/json"
                                });

                        }

                        // Construct the final response JSON
                        const responseData = {
                                id: pet_id,
                                name: pet_record.getValue({ fieldId: pet_name_field }),
                                type: pet_record.getText({ fieldId: pet_type_field }),
                                breed: pet_record.getText({ fieldId: pet_breed_field }),
                                customer: {
                                        id: customer_id,
                                        first_name: customer_record.getValue({ fieldId: customer_first_name_field }),
                                        last_name: customer_record.getValue({ fieldId: customer_last_name_field }),
                                        email: customer_record.getValue({ fieldId: customer_email_field })
                                },
                                birth_date: pet_record.getText({ fieldId: pet_birth_date_field }),
                                weight: pet_record.getValue({ fieldId: pet_weight_field }),
                                anniversary_date: pet_record.getText({ fieldId: pet_anniversary_field }),
                                status: pet_record.getText({ fieldId: pet_status_field }),

                        };


                        return restlet.createResponse({
                                content: JSON.stringify(responseData),
                                contentType: "application/json"
                        });

                } catch (e) {
                        log.error('GET Error processing Pet ID ' + requestData.pet_id, e);

                        return restlet.createResponse({
                                content: JSON.stringify({ success: false, message: `Error retrieving pet record: ${e.message}` }),
                                contentType: "application/json"
                        });
                }
        };

        const post = (data) => {
                log.debug('POST Request Received', JSON.stringify(data));

                const pet_name = data.pet.name;
                const pet_type = data.pet.type;
                const breed_id = data.pet.breed;
                const weight = data.pet.weight;
                const pet_customer_id = data.customer.id;
                const pet_customer_first_name = data.customer.first_name;
                const pet_customer_last_name = data.customer.last_name;
                const pet_customer_email = data.customer.email;
                const subsidiary_id = data.customer.subsidiary;
                let pet_birth_date;
                let pet_anniversary_date;
                const WELCOME_BOX = 914;

                try {
                        pet_birth_date = format.parse({
                                value: data.pet.birth_date,
                                type: format.Type.DATE
                        });
                        pet_anniversary_date = format.parse({
                                value: data.pet.anniversary_date,
                                type: format.Type.DATE
                        });
                } catch (e) {
                        log.error('Error Parsing Dates', e);
                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: false,
                                        message: `Invalid birth_date: ${data.pet.birth_date}, or anniversary_date: ${data.pet.anniversary_date}`
                                }),
                                contentType: "application/json",
                        });
                }

                try {
                        let finalCustomerId;

                        if (pet_customer_id) {
                                // Check if customer exists by ID
                                try {
                                        const customerRecord = record.load({
                                                type: record.Type.CUSTOMER,
                                                id: pet_customer_id
                                        });
                                        finalCustomerId = customerRecord.id;
                                        log.audit('Existing Customer Found', `ID: ${finalCustomerId}`);
                                } catch (e) {
                                        log.audit('Customer ID not found, creating a new customer', pet_customer_id);
                                        finalCustomerId = createCustomer();
                                }
                        } else {
                                // No customer ID provided, create a new customer
                                finalCustomerId = createCustomer();
                        }

                        // Create pet
                        const petRecord = record.create({
                                type: pet_record_type,
                                isDynamic: false
                        });

                        petRecord.setValue({ fieldId: pet_name_field, value: pet_name });
                        petRecord.setValue({ fieldId: pet_customer_field, value: finalCustomerId });
                        petRecord.setValue({ fieldId: pet_type_field, value: pet_type });
                        petRecord.setValue({ fieldId: pet_breed_field, value: breed_id });
                        petRecord.setValue({ fieldId: pet_birth_date_field, value: pet_birth_date });
                        petRecord.setValue({ fieldId: pet_weight_field, value: weight });
                        petRecord.setValue({ fieldId: pet_anniversary_field, value: pet_anniversary_date });

                        const finalPetId = petRecord.save();
                        log.audit('New Pet Created', `Pet ID: ${finalPetId}`);

                        // Create initial Sales Order with Welcome Box
                        const salesOrder = record.create({
                                type: record.Type.SALES_ORDER,
                                isDynamic: true
                        });

                        salesOrder.setValue({
                                fieldId: 'entity',
                                value: finalCustomerId
                        });

                        salesOrder.selectNewLine({ sublistId: 'item' });
                        salesOrder.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                value: WELCOME_BOX
                        });
                        salesOrder.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                value: 1
                        });
                        salesOrder.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'description',
                                value: `Welcome Box for ${pet_name}`
                        });
                        salesOrder.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'amount',
                                value: 0
                        });
                        salesOrder.commitLine({ sublistId: 'item' });

                        const salesOrderId = salesOrder.save();
                        log.audit('Sales Order Created', `Sales Order ID: ${salesOrderId}`);

                        // Final response
                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: true,
                                        pet_id: finalPetId,
                                        customer_id: finalCustomerId,
                                        sales_order_id: salesOrderId
                                }),
                                contentType: "application/json"
                        });

                } catch (e) {
                        log.error('Error in POST process', e);
                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: false,
                                        message: `Error: ${e.message}`
                                }),
                                contentType: "application/json",
                        });
                }

                function createCustomer() {
                        const newCustomer = record.create({
                                type: record.Type.CUSTOMER,
                                isDynamic: true
                        });

                        newCustomer.setValue({ fieldId: 'firstname', value: pet_customer_first_name });
                        newCustomer.setValue({ fieldId: 'lastname', value: pet_customer_last_name });
                        newCustomer.setValue({ fieldId: 'email', value: pet_customer_email });
                        newCustomer.setValue({ fieldId: 'isperson', value: "T" });
                        newCustomer.setValue({ fieldId: 'subsidiary', value: subsidiary_id });

                        const customerId = newCustomer.save();
                        log.audit('New Customer Created', `ID: ${customerId}`);
                        return customerId;
                }
        };

        const put = (data) => {
                log.debug('PUT Request Received', JSON.stringify(data));

                const pet_id = data.parameters?.pet_id;
                const pet_name = data.name;
                const pet_type = data.type;
                const breed_id = data.breed;
                const weight = data.weight;
                let pet_birth_date;
                let pet_anniversary_date;

                if (!pet_id) {
                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: false,
                                        message: 'Pet ID is required as a parameter for update'
                                }),
                                contentType: "application/json",
                        });
                }

                try {
                        pet_birth_date = format.parse({
                                value: data.birth_date,
                                type: format.Type.DATE
                        });
                        pet_anniversary_date = format.parse({
                                value: data.anniversary_date,
                                type: format.Type.DATE
                        });
                } catch (e) {
                        log.error('Error Parsing Birth Date', e);
                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: false,
                                        message: `Invalid birth_date format: ${data.birth_date} or anniversary_date: ${data.anniversary_date}`
                                }),
                                contentType: "application/json",
                        });
                }

                try {
                        const petRecord = record.load({
                                type: pet_record_type,
                                id: pet_id,
                                isDynamic: false
                        });

                        petRecord.setValue({ fieldId: pet_type_field, value: pet_type });
                        petRecord.setValue({ fieldId: pet_breed_field, value: breed_id });
                        petRecord.setValue({ fieldId: pet_name_field, value: pet_name });
                        petRecord.setValue({ fieldId: pet_birth_date_field, value: pet_birth_date });
                        petRecord.setValue({ fieldId: pet_weight_field, value: weight });
                        petRecord.setValue({ fieldId: pet_anniversary_field, value: pet_anniversary_date });

                        const updatedPetId = petRecord.save();
                        log.audit('Pet Updated', `Pet ID: ${updatedPetId}`);

                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: true,
                                        pet_id: updatedPetId
                                }),
                                contentType: "application/json"
                        });

                } catch (e) {
                        log.error('Error in PUT process', e);
                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: false,
                                        message: `Error: ${e.message}`
                                }),
                                contentType: "application/json",
                        });
                }
        };

        return {
                get,
                post,
                put
        };
});