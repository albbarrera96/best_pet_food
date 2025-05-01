/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function(search, record, log) {

    const pet_record_type = 'customrecord_bpc_bf_pet';
    const pet_type_field = 'custrecord_bpc_bf_type';
    const pet_age_field = 'custrecord_bpc_age_in_months';
    const pet_weight_field = 'custrecord_bpc_current_weight_kg';
    const pet_expected_weight_field = 'custrecord_bpc_expected_adult_weight';
    const pet_status_field = 'custrecord_bpc_pet_status';

    function getInputData() {
        return search.create({
            type: pet_record_type,
            filters: [
                ['custrecord_bpc_bf_type', 'anyof', '1', '2'] // Dog = 2, Cat = 1
            ],
            columns: [
                'internalid',
                pet_type_field,
                pet_age_field,
                pet_weight_field,
                pet_expected_weight_field
            ]
        });
    }

    function calculateExpectedWeight(type, ageMonths, expectedAdultWeight) {
        const ageYears = ageMonths / 12;
        let expectedWeight = expectedAdultWeight;

        if (type === '2') { // Dog
            if (ageMonths < 24) {
                expectedWeight = ageMonths >= 12
                    ? expectedAdultWeight * 0.75
                    : expectedAdultWeight * (0.75 * (ageMonths / 12));
            }
        } else if (type === '1') { // Cat
            if (ageMonths < 24) {
                expectedWeight = expectedAdultWeight * (ageMonths / 24);
            }
        }

        return parseFloat(expectedWeight.toFixed(2));
    }

    function determineStatus(expected, actual) {
        const diff = actual - expected;

        if (Math.abs(diff) <= 2) return 'Within expected range';
        if (diff < -2) return 'Below expected weight';
        if (diff > 2) return 'Above expected weight';

        return 'Check weight manually';
    }

    function map(context) {
        const pet = JSON.parse(context.value);
        const id = pet.id;
        const values = pet.values;

        const petType = values[pet_type_field]?.value;
        const ageMonths = parseFloat(values[pet_age_field]) || 0;
        const actualWeight = parseFloat(values[pet_weight_field]) || 0;
        const expectedAdultWeight = parseFloat(values[pet_expected_weight_field]) || 0;

        if (!petType || !expectedAdultWeight) return;

        const expectedWeight = calculateExpectedWeight(petType, ageMonths, expectedAdultWeight);
        const status = determineStatus(expectedWeight, actualWeight);

        // Only update if different from actual
        if (Math.abs(expectedWeight - actualWeight) > 2) {
            try {
                record.submitFields({
                    type: pet_record_type,
                    id,
                    values: {
                        [pet_weight_field]: expectedWeight,
                        [pet_status_field]: status
                    }
                });

                log.audit('Updated Pet Weight', { id, expectedWeight, status });
            } catch (e) {
                log.error('Failed to update pet', { id, error: e });
            }
        } else {
            // Just update the status
            record.submitFields({
                type: pet_record_type,
                id,
                values: {
                    [pet_status_field]: status
                }
            });
            log.audit('Updated Pet Status Only', { id, actualWeight, expectedWeight, status });
        }
    }

    return {
        getInputData,
        map
    };
});