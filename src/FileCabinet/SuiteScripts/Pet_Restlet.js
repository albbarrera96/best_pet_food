/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(["N/scriptTypes/restlet", "N/search", "N/log", "N/record", "N/format"], function(restlet, search, log, record, format) {

        const pet_record_type = 'customrecord_bpc_bf_pet';
        const breed_record_type = 'customrecord_bpc_bf_breed';

        // Pet Record Fields
        const pet_name_field = 'name';
        const pet_type_field = 'custrecord_bpc_bf_type';
        const pet_breed_field = 'custrecord_bpc_bf_pet_breed';
        const pet_customer_field = 'custrecord_bpc_bf_pet_cust';
        const pet_birth_date_field = 'custrecord_bpc_birth_date';
        const pet_weight_field = 'custrecord_bpc_current_weight_kg';
        const pet_anniversary_field = 'custrecord_bpc_anniversary_date';

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
                                anniversary: pet_record.getText({ fieldId: pet_anniversary_field }),

                                customer_id: customer_id
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

                const customer_id = data.customer_id || null;
                const pet_id = data.id || null;
                const pet_name = data.name;
                const pet_type = data.type;
                const breed_id = data.breed;
                const weight = data.weight;
                const pet_customer_first_name = data.customer_first_name;
                const pet_customer_last_name = data.customer_last_name;
                const pet_customer_email = data.customer_email;
                const subsidiary_id = data.subsidiary_id;
                let pet_birth_date;
                const WELCOME_BOX = 914;

                try {
                        pet_birth_date = format.parse({
                                value: data.birth_date,
                                type: format.Type.DATE
                        });
                } catch (e) {
                        log.error('Error Parsing Birth Date', e);
                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: false,
                                        message: `Invalid birth_date format: ${data.birth_date}`
                                }),
                                contentType: "application/json",
                        });
                }

                try {
                        let finalCustomerId = customer_id;
                        let finalPetId = pet_id;
                        let CASE = '';

                        // --- Detect CASE ---
                        if (!customer_id) {
                                CASE = 'CREATE_CUSTOMER';
                        } else if (!pet_id) {
                                CASE = 'CREATE_PET';
                        } else {
                                CASE = 'UPDATE_PET';
                        }

                        log.debug('Detected CASE', CASE);

                        // 1. CREATE CUSTOMER
                        if (CASE === 'CREATE_CUSTOMER') {
                                const newCustomer = record.create({
                                        type: record.Type.CUSTOMER,
                                        isDynamic: true
                                });

                                newCustomer.setValue({ fieldId: 'firstname', value: pet_customer_first_name });
                                newCustomer.setValue({ fieldId: 'lastname', value: pet_customer_last_name });
                                newCustomer.setValue({ fieldId: 'email', value: pet_customer_email });
                                newCustomer.setValue({ fieldId: 'isperson', value: "T" });
                                newCustomer.setValue({ fieldId: 'subsidiary', value: subsidiary_id });

                                finalCustomerId = newCustomer.save();
                                log.audit('New Customer created', `ID: ${finalCustomerId}`);
                        } else {
                                // Check existing customer
                                try {
                                        record.load({
                                                type: record.Type.CUSTOMER,
                                                id: Number(customer_id)
                                        });
                                } catch (e) {
                                        return restlet.createResponse({
                                                content: JSON.stringify({
                                                        success: false,
                                                        message: `Provided Customer ID ${customer_id} does not exist`
                                                }),
                                                contentType: "application/json",
                                        });
                                }
                        }

                        // 2. CREATE or UPDATE PET
                        if (CASE === 'UPDATE_PET') {
                                const petRecord = record.load({
                                        type: pet_record_type,
                                        id: finalPetId,
                                        isDynamic: false
                                });

                                petRecord.setValue({ fieldId: pet_type_field, value: pet_type });
                                petRecord.setValue({ fieldId: pet_breed_field, value: breed_id });
                                petRecord.setValue({ fieldId: pet_name_field, value: pet_name });
                                petRecord.setValue({ fieldId: pet_birth_date_field, value: pet_birth_date });
                                petRecord.setValue({ fieldId: pet_weight_field, value: weight });

                                finalPetId = petRecord.save();
                                log.audit('Pet Updated', `Pet ID: ${finalPetId}`);

                        } else {
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

                                finalPetId = petRecord.save();
                                log.audit('New Pet Created', `Pet ID: ${finalPetId}`);
                        }

                        // 3. Create initial Sales Order with Welcome Box
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

                        // --- Final response
                        return restlet.createResponse({
                                content: JSON.stringify({
                                        success: true,
                                        case_detected: CASE,
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
        };

        return {
                get,
                post
        };
});
