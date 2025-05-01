/**
 * @NModuleScope Public
 */
define([], function () {
    return {
        recordTypes: {
            pet: {
                id: 'customrecord_bpc_bf_pet',
                fields: {
                    name: 'name',
                    type: 'custrecord_bpc_bf_type',
                    breed: 'custrecord_bpc_bf_pet_breed',
                    customer: 'custrecord_bpc_bf_pet_cust',
                    birthDate: 'custrecord_bpc_birth_date',
                    weightInKg: 'custrecord_bpc_current_weight_kg',
                    anniversaryDate: 'custrecord_bpc_anniversary_date',
                    status: 'custrecord_bpc_pet_status',
                    ageInMonths: 'custrecord_bpc_age_in_months',
                    breedExpectedWeight: 'custrecord_bpc_expected_adult_weight',
                    lastOrderDate: 'custrecord_bpc_last_order_date'
                }
            },
            customer: {
                fields: {
                    firstName: 'firstname',
                    lastName: 'lastname',
                    email: 'email',
                    isPerson: 'isperson',
                    subsidiary: 'subsidiary'
                }
            },
            item: {
                fields: {
                    name: 'itemid',
                    type: 'type',
                    description: 'description',
                    animalType: 'custitem_bpc_animal_type',
                    quantity: 'quantityavailable',
                    petType: 'custitem_pet_type',
                    petStage: 'custitem_pet_stage',
                    sizeCups: 'custitem_size_cups'
                },
                constants: {
                    welcomeBoxId: 914
                }
            },
            salesOrder: {
                fields: {
                    // Define fields for sales order if needed
                }
            }
        },
        savedSearches: {
            petFoodItems: 'customsearch_pet_food_items'
        }
    };
});
