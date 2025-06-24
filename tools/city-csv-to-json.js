// Converts a CSV file of city data to a JSON format that can be placed in the data-looups.json file
const fs = require('fs');

if (process.argv.length < 4) {
    console.error('Usage: node city-csv-to-json.js <input.csv> <output.json>');
    process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3];

const csv = fs.readFileSync(inputFile, 'utf8');
const lines = csv.trim().split('\n');
const headers = lines[0].replace(/^\uFEFF/, '').split(',').reduce((acc, header, idx) => {
    acc[header.trim()] = idx;
    return acc;
}, {});

const results = lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
        region: String(cols[headers['regionId']]),
        name: cols[headers['cityName']],
        id: Number(cols[headers['cityId']]),
        position: {
            lat: Number(cols[headers['cityLat']]),
            lng: Number(cols[headers['cityLng']])
        }
    };
});

fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log(`Converted data written to ${outputFile}`);