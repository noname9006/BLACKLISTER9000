import fs from 'fs';

// blacklister3.js
// - Reads ref_codes.csv (expected sorted by issuer address)
// - Detects issuers who have at least 2 codes where the difference between
//   their updated_at timestamps is less than 5 minutes
// - When detected, exports the issuer address and all its invitees (used_by)
//   into bl3.csv as a single lowercase-address column

// Configuration
const INPUT_CSV = 'ref_codes.csv';
const OUTPUT_CSV = 'bl3.csv';
const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isNullAddress(address) {
    if (!address || typeof address !== 'string') return true;
    const clean = address.toLowerCase().replace(/^0x/, '');
    return clean.length < 40 || /^0+$/.test(clean);
}

// Simple CSV parser that handles basic quoted values
function parseCSV(path) {
    if (!fs.existsSync(path)) return [];
    const raw = fs.readFileSync(path, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return [];
    const headers = splitCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = splitCSVLine(lines[i]);
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j].trim()] = (values[j] !== undefined) ? values[j].trim() : '';
        }
        rows.push(row);
    }
    return rows;
}

// Splits a single CSV line into values (basic support for quoted fields)
function splitCSVLine(line) {
    const values = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            // Peek next char for double-quote escape
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                cur += '"';
                i++; // skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            values.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    values.push(cur);
    return values;
}

// Safely parse a timestamp field into milliseconds since epoch
function parseTime(value) {
    if (!value) return NaN;
    // Trim and try direct Date.parse
    const s = String(value).trim();
    const num = Number(s);
    if (!Number.isNaN(num) && num > 0) return num; // already epoch ms or s
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) return parsed;
    // Try parsing as seconds since epoch
    if (!Number.isNaN(num) && num > 0) return num * 1000;
    return NaN;
}

function writeSingleColumnCSV(path, values, header = 'address') {
    const lines = [header, ...values];
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
}

function main() {
    try {
        if (!fs.existsSync(INPUT_CSV)) {
            console.error(`Input file not found: ${INPUT_CSV}`);
            return;
        }

        const rows = parseCSV(INPUT_CSV);
        if (rows.length === 0) {
            console.error(`No rows parsed from ${INPUT_CSV}`);
            return;
        }

        // Determine timestamp column: prefer updated_at, fallbacks
        const candidateTimeCols = ['updated_at', 'updatedAt', 'timestamp', 'updated', 'created_at', 'createdAt', 'date'];
        const headerKeys = Object.keys(rows[0]);
        let timeCol = null;
        for (const c of candidateTimeCols) {
            if (headerKeys.includes(c)) { timeCol = c; break; }
        }
        if (!timeCol) {
            // pick any column that looks like a timestamp name
            timeCol = headerKeys.find(h => /updated|time|date|timestamp/i.test(h)) || headerKeys[0];
            console.warn(`No explicit updated_at column found, using '${timeCol}' as timestamp column`);
        } else {
            console.log(`Using timestamp column: ${timeCol}`);
        }

        // Determine issuer and invitee (used_by) columns (flexible)
        const issuerCols = ['issued_by', 'issuer', 'referrer', 'owner'];
        const usedCols = ['used_by', 'user', 'invitee', 'wallet', 'wallet_address'];

        const issuerCol = headerKeys.find(h => issuerCols.includes(h)) || headerKeys.find(h => /issue|issuer|issued_by|referrer/i.test(h)) || 'issued_by';
        const usedCol = headerKeys.find(h => usedCols.includes(h)) || headerKeys.find(h => /used_by|user|invitee|wallet/i.test(h)) || 'used_by';

        console.log(`Detected issuer column: ${issuerCol}, invitee column: ${usedCol}`);

        // Group rows by issuer
        const groups = new Map(); // issuer -> [{time, used}]

        for (const r of rows) {
            const issuerRaw = (r[issuerCol] || '').trim();
            const usedRaw = (r[usedCol] || '').trim();

            if (!issuerRaw) continue;
            const issuer = issuerRaw.toLowerCase();
            if (isNullAddress(issuer)) continue;

            const timeVal = parseTime(r[timeCol]);
            if (Number.isNaN(timeVal)) continue; // ignore rows without parseable time

            if (!groups.has(issuer)) groups.set(issuer, []);
            groups.get(issuer).push({ time: timeVal, used: (usedRaw || '').toLowerCase() });
        }

        console.log(`Grouped into ${groups.size} issuers`);

        const suspects = new Set();
        const suspectInvitees = new Map(); // issuer -> Set(invitees)

        // For each issuer, sort by time and look for any two entries within the TIME_WINDOW_MS
        for (const [issuer, entries] of groups) {
            if (entries.length < 2) continue;
            // sort ascending by time
            entries.sort((a, b) => a.time - b.time);

            let found = false;
            for (let i = 0; i < entries.length - 1; i++) {
                const t1 = entries[i].time;
                // check ahead until outside window (handles cases where non-adjacent are within window)
                for (let j = i + 1; j < entries.length; j++) {
                    const t2 = entries[j].time;
                    if (t2 - t1 <= TIME_WINDOW_MS) {
                        found = true;
                        break;
                    }
                    // if difference already greater than window, break inner loop
                    if (t2 - t1 > TIME_WINDOW_MS) break;
                }
                if (found) break;
            }

            if (found) {
                suspects.add(issuer);
                if (!suspectInvitees.has(issuer)) suspectInvitees.set(issuer, new Set());
                entries.forEach(e => {
                    if (e.used && !isNullAddress(e.used) && e.used !== issuer) {
                        suspectInvitees.get(issuer).add(e.used);
                    }
                });
            }
        }

        console.log(`Detected ${suspects.size} issuers with >1 codes within 5 minutes`);

        // Build final list: for each suspect issuer include issuer and its invitees
        const outputSet = new Set();
        for (const issuer of suspects) {
            outputSet.add(issuer.toLowerCase());
            const invs = suspectInvitees.get(issuer) || new Set();
            invs.forEach(u => outputSet.add(u.toLowerCase()));
        }

        const outputList = Array.from(outputSet);
        outputList.sort();

        writeSingleColumnCSV(OUTPUT_CSV, outputList, 'address');

        console.log(`Wrote ${outputList.length} addresses to ${OUTPUT_CSV}`);
    } catch (err) {
        console.error('Error:', err && err.message ? err.message : err);
        console.error(err && err.stack ? err.stack : '');
    }
}

main();