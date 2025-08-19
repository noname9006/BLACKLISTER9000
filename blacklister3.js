import fs from 'fs';

// Function to check if an address is a null/zero address
function isNullAddress(address) {
    if (!address || typeof address !== 'string') return true;
    
    // Remove '0x' prefix and check if it's all zeros or too short
    const cleanAddress = address.toLowerCase().replace('0x', '');
    
    // Check if it's all zeros, empty, or less than 40 characters (proper ETH address length)
    return cleanAddress.length < 40 || /^0+$/.test(cleanAddress);
}

// Function to parse CSV files
function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File ${filePath} does not exist`);
        return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
        console.error(`Error: File ${filePath} is empty`);
        return [];
    }
    
    const headers = lines[0].split(',').map(header => header.trim());
    
    return lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        return row;
    });
}

// Function to write CSV file
function writeCSV(filePath, data, headers) {
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => row[header] || '').join(','))
    ].join('\n');
    
    fs.writeFileSync(filePath, csvContent, 'utf8');
}

// Function to parse date string and return Date object
function parseDate(dateString) {
    if (!dateString) return null;
    
    // Try multiple date formats
    const formats = [
        // ISO format
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        // Date only
        /^\d{4}-\d{2}-\d{2}/,
        // Timestamp
        /^\d{10,13}$/
    ];
    
    // Check if it's a timestamp (seconds or milliseconds)
    if (/^\d{10,13}$/.test(dateString)) {
        const timestamp = parseInt(dateString);
        // If it's in seconds, convert to milliseconds
        return new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
    }
    
    // Try parsing as ISO date
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

// Main analysis function
function detectSuspiciousIssuers() {
    try {
        const startTime = Date.now();
        console.log('Starting suspicious issuer detection...');
        console.log('Target: Issuers with 2+ codes issued within 5 minutes');
        console.log('Cutoff date: 2025-07-07');
        
        // Read ref_codes.csv
        console.log('Reading ref_codes.csv...');
        const refCodes = parseCSV('ref_codes.csv');
        
        if (refCodes.length === 0) {
            console.error('Error: No data found in ref_codes.csv');
            return;
        }
        
        console.log(`Loaded ${refCodes.length} referral codes`);
        
        // Check available columns
        const headers = Object.keys(refCodes[0]);
        console.log('Available columns:', headers.join(', '));
        
        // Define cutoff date (2025-07-07)
        const cutoffDate = new Date('2025-07-07T00:00:00Z');
        console.log('Cutoff date:', cutoffDate.toISOString());
        
        // Process and filter data
        console.log('Processing referral codes...');
        
        const validCodes = [];
        let nullAddressSkipped = 0;
        let beforeCutoffSkipped = 0;
        let invalidDateSkipped = 0;
        
        refCodes.forEach((code, index) => {
            const issuer = code['issued_by'] ? code['issued_by'].toLowerCase().trim() : '';
            const user = code['used_by'] ? code['used_by'].toLowerCase().trim() : '';
            
            // Skip null addresses
            if (isNullAddress(issuer)) {
                nullAddressSkipped++;
                return;
            }
            
            // Skip if user is null (we need valid invitee)
            if (isNullAddress(user)) {
                nullAddressSkipped++;
                return;
            }
            
            // Parse updated_at date
            const updatedAtStr = code['updated_at'] || code['created_at'] || code['timestamp'] || code['date'] || '';
            const updatedAt = parseDate(updatedAtStr);
            
            if (!updatedAt) {
                invalidDateSkipped++;
                console.log(`Warning: Invalid date format at row ${index + 1}: "${updatedAtStr}"`);
                return;
            }
            
            // Check if after cutoff date
            if (updatedAt < cutoffDate) {
                beforeCutoffSkipped++;
                return;
            }
            
            validCodes.push({
                issuer: issuer,
                user: user,
                updated_at: updatedAt,
                original_updated_at: updatedAtStr,
                row_index: index + 1
            });
        });
        
        console.log(`\nFiltering results:`);
        console.log(`  - Valid codes after ${cutoffDate.toDateString()}: ${validCodes.length}`);
        console.log(`  - Skipped (null addresses): ${nullAddressSkipped}`);
        console.log(`  - Skipped (before cutoff): ${beforeCutoffSkipped}`);
        console.log(`  - Skipped (invalid dates): ${invalidDateSkipped}`);
        
        if (validCodes.length === 0) {
            console.log('No valid codes found after filtering. Exiting.');
            return;
        }
        
        // Group by issuer and sort by updated_at
        console.log('Grouping codes by issuer...');
        const issuerGroups = new Map();
        
        validCodes.forEach(code => {
            if (!issuerGroups.has(code.issuer)) {
                issuerGroups.set(code.issuer, []);
            }
            issuerGroups.get(code.issuer).push(code);
        });
        
        // Sort each issuer's codes by updated_at
        issuerGroups.forEach(codes => {
            codes.sort((a, b) => a.updated_at.getTime() - b.updated_at.getTime());
        });
        
        console.log(`Found ${issuerGroups.size} unique issuers`);
        
        // Detect suspicious issuers (2+ codes within 5 minutes)
        console.log('Detecting suspicious timing patterns...');
        
        const suspiciousIssuers = new Set();
        const suspiciousDetails = [];
        const FIVE_MINUTES_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        issuerGroups.forEach((codes, issuer) => {
            if (codes.length < 2) return;
            
            // Check for any pair of codes within 5 minutes
            for (let i = 0; i < codes.length - 1; i++) {
                for (let j = i + 1; j < codes.length; j++) {
                    const timeDiff = codes[j].updated_at.getTime() - codes[i].updated_at.getTime();
                    
                    if (timeDiff <= FIVE_MINUTES_MS) {
                        suspiciousIssuers.add(issuer);
                        
                        const timeDiffSeconds = Math.floor(timeDiff / 1000);
                        const timeDiffMinutes = Math.floor(timeDiffSeconds / 60);
                        const remainingSeconds = timeDiffSeconds % 60;
                        
                        suspiciousDetails.push({
                            issuer: issuer,
                            total_codes: codes.length,
                            time_diff_ms: timeDiff,
                            time_diff_display: `${timeDiffMinutes}m ${remainingSeconds}s`,
                            code1_time: codes[i].updated_at.toISOString(),
                            code2_time: codes[j].updated_at.toISOString(),
                            code1_user: codes[i].user,
                            code2_user: codes[j].user
                        });
                        
                        break; // Found suspicious pattern for this issuer
                    }
                }
                if (suspiciousIssuers.has(issuer)) break;
            }
        });
        
        console.log(`\nSuspicious timing detection results:`);
        console.log(`  - Suspicious issuers found: ${suspiciousIssuers.size}`);
        
        if (suspiciousIssuers.size === 0) {
            console.log('No suspicious issuers detected. Creating empty bl3.csv file.');
            writeCSV('bl3.csv', [], ['address']);
            return;
        }
        
        // Display suspicious patterns
        console.log('\nSuspicious timing patterns detected:');
        suspiciousDetails.forEach((detail, index) => {
            console.log(`${index + 1}. Issuer: ${detail.issuer}`);
            console.log(`   Total codes: ${detail.total_codes}`);
            console.log(`   Time difference: ${detail.time_diff_display}`);
            console.log(`   Code 1: ${detail.code1_time} -> ${detail.code1_user}`);
            console.log(`   Code 2: ${detail.code2_time} -> ${detail.code2_user}`);
            console.log('');
        });
        
        // Collect all addresses (issuers + their invitees)
        console.log('Collecting all related addresses...');
        const allAddresses = new Set();
        
        // Add suspicious issuers
        suspiciousIssuers.forEach(issuer => {
            allAddresses.add(issuer);
        });
        
        // Add all invitees of suspicious issuers
        suspiciousIssuers.forEach(issuer => {
            const codes = issuerGroups.get(issuer);
            codes.forEach(code => {
                allAddresses.add(code.user);
            });
        });
        
        console.log(`\nAddress collection results:`);
        console.log(`  - Suspicious issuers: ${suspiciousIssuers.size}`);
        console.log(`  - Total unique addresses (issuers + invitees): ${allAddresses.size}`);
        
        // Create output data (single column, lowercase)
        const outputData = Array.from(allAddresses)
            .sort() // Sort alphabetically
            .map(address => ({ address: address }));
        
        // Write to bl3.csv
        writeCSV('bl3.csv', outputData, ['address']);
        
        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`\nAnalysis complete in ${elapsedTime.toFixed(1)} seconds!`);
        console.log(`${outputData.length} addresses written to bl3.csv`);
        
        // Summary statistics
        const totalInvitees = allAddresses.size - suspiciousIssuers.size;
        console.log(`\nSummary:`);
        console.log(`  - Suspicious issuers: ${suspiciousIssuers.size}`);
        console.log(`  - Their invitees: ${totalInvitees}`);
        console.log(`  - Total addresses exported: ${allAddresses.size}`);
        
    } catch (error) {
        console.error('Error during analysis:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the analysis
detectSuspiciousIssuers();