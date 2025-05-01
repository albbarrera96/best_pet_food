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
                const pet = JSON.parse(context.value);
                const pet_id = pet.id;
                const customer_id = pet.values[pet_customer_field]?.value;
                const pet_name = pet.values[pet_name_field];
                const pet_weight_kg = parseFloat(pet.values[pet_weight_field]) || 0;
                const pet_weight_lbs = pet_weight_kg * 2.20462;
                const pet_age_in_months = parseInt(pet.values[pet_age_in_months_field]) || 0;
                const breed_size = pet.values[pet_breed_size_field];
                const pet_type = pet.values[pet_type_field];
                const last_order_date = pet.values[pet_last_order_date_field];
                const anniversary_date = pet.values[pet_anniversary_date_field];

                log.debug('Pet Inf Detailed', {
                        pet_id,
                        customer_id,
                        pet_name,
                        pet_weight_kg,
                        pet_weight_lbs,
                        pet_age_in_months,
                        breed_size,
                        pet_type,
                        last_order_date,
                        anniversary_date
                });


        }
        return {
                getInputData,
                map
        };
});
