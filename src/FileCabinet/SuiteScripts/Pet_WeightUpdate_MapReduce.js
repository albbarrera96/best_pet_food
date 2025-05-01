/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log', './bpc_pet_config'], function (search, record, log, config) {

    const PET = config.recordTypes.pet;

    function getInputData() {
        return search.create({
            type: PET.id,
            filters: [
                [PET.fields.type, 'anyof', '1', '2'] // Cat or Dog
            ],
            columns: [
                'internalid',
                PET.fields.type,
                PET.fields.ageInMonths,
                PET.fields.weightInKg,
                PET.fields.breedExpectedWeight
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

        const petType = values[PET.fields.type]?.value;
        const ageMonths = parseFloat(values[PET.fields.ageInMonths]) || 0;
        const actualWeight = parseFloat(values[PET.fields.weightInKg]) || 0;
        const expectedAdultWeight = parseFloat(values[PET.fields.breedExpectedWeight]) || 0;

        if (!petType || !expectedAdultWeight) return;

        const expectedWeight = calculateExpectedWeight(petType, ageMonths, expectedAdultWeight);
        const status = determineStatus(expectedWeight, actualWeight);

        try {
            const valuesToUpdate = {};
            valuesToUpdate[PET.fields.status] = status;

            if (Math.abs(expectedWeight - actualWeight) > 2) {
                valuesToUpdate[PET.fields.weightInKg] = Math.round(expectedWeight);
                log.audit('Updating pet weight and status', { id, expectedWeight, status });
            } else {
                log.audit('Updating pet status only', { id, expectedWeight, actualWeight, status });
            }

            record.submitFields({
                type: PET.id,
                id,
                values: valuesToUpdate
            });

        } catch (e) {
            log.error('Failed to update pet record', { id, error: e });
        }
    }

    return {
        getInputData,
        map
    };
});
