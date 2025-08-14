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
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
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

// Main analysis function
function analyzeReferralChains() {
    try {
        console.log('Reading ref_codes.csv...');
        const refCodes = parseCSV('ref_codes.csv');
        
        console.log('Reading BL.csv...');
        const blacklistData = parseCSV('BL.csv');
        
        // Extract blacklisted wallets from BL.csv
        const blacklistedWallets = new Set();
        
        const blHeaders = Object.keys(blacklistData[0]);
        if (blHeaders.length > 0 && !isNullAddress(blHeaders[0])) {
            blacklistedWallets.add(blHeaders[0].toLowerCase());
        }
        
        blacklistData.forEach(row => {
            Object.values(row).forEach(address => {
                if (address && address.startsWith('0x') && !isNullAddress(address)) {
                    blacklistedWallets.add(address.toLowerCase());
                }
            });
        });
        
        console.log(`Found ${blacklistedWallets.size} valid blacklisted wallets`);
        console.log(`Found ${refCodes.length} referral codes`);
        
        // Build referral chains and track all addresses
        const chains = new Map(); // issuer -> Set of users
        const reverseChains = new Map(); // user -> Set of issuers
        const userCodeCount = new Map(); // user -> count of codes used
        
        let processedCount = 0;
        let nullAddressSkipped = 0;
        
        refCodes.forEach((code) => {
            const issuer = code['issued_by'] ? code['issued_by'].toLowerCase() : '';
            const user = code['used_by'] ? code['used_by'].toLowerCase() : '';
            const used = code['used'];
            
            // Skip if either address is null/zero address
            if (isNullAddress(issuer) || isNullAddress(user)) {
                nullAddressSkipped++;
                return;
            }
            
            if (issuer && user && used) {
                // Forward chains (issuer -> users)
                if (!chains.has(issuer)) {
                    chains.set(issuer, new Set());
                }
                chains.get(issuer).add(user);
                
                // Reverse chains (user -> issuers) for faster lookup
                if (!reverseChains.has(user)) {
                    reverseChains.set(user, new Set());
                }
                reverseChains.get(user).add(issuer);
                
                // Count codes used by each user
                userCodeCount.set(user, (userCodeCount.get(user) || 0) + 1);
                
                processedCount++;
            }
        });
        
        console.log(`Processed ${processedCount} referral codes`);
        console.log(`Skipped ${nullAddressSkipped} codes with null/zero addresses`);
        console.log(`Built ${chains.size} referral chains`);
        
        // Find suspicious addresses using a more limited approach
        console.log('Finding addresses directly connected to blacklisted addresses...');
        const suspiciousAddresses = new Set();
        
        // Method 1: Find direct connections (1-2 hops) from blacklisted addresses
        const maxHops = 2; // Limit to 2 hops to avoid the entire network
        
        function findConnectedAddresses(startAddress, currentHop = 0, visited = new Set()) {
            if (currentHop >= maxHops || visited.has(startAddress)) return;
            
            visited.add(startAddress);
            suspiciousAddresses.add(startAddress);
            
            // Add direct users of this issuer
            if (chains.has(startAddress)) {
                chains.get(startAddress).forEach(user => {
                    if (!visited.has(user)) {
                        findConnectedAddresses(user, currentHop + 1, new Set(visited));
                    }
                });
            }
            
            // Add direct issuers that this user used codes from
            if (reverseChains.has(startAddress)) {
                reverseChains.get(startAddress).forEach(issuer => {
                    if (!visited.has(issuer)) {
                        findConnectedAddresses(issuer, currentHop + 1, new Set(visited));
                    }
                });
            }
        }
        
        let blacklistedInChains = 0;
        blacklistedWallets.forEach(wallet => {
            if (chains.has(wallet) || reverseChains.has(wallet)) {
                blacklistedInChains++;
                findConnectedAddresses(wallet);
            }
        });
        
        console.log(`Found ${blacklistedInChains} blacklisted addresses involved in referral chains`);
        console.log(`Found ${suspiciousAddresses.size} suspicious addresses within ${maxHops} hops`);
        
        // Alternative method: Find addresses that share many connections with blacklisted addresses
        console.log('Finding addresses with high blacklisted connection rates...');
        const connectionScores = new Map();
        
        // Score addresses based on their connections to blacklisted addresses
        blacklistedWallets.forEach(blacklistedAddr => {
            // Check users of blacklisted issuers
            if (chains.has(blacklistedAddr)) {
                chains.get(blacklistedAddr).forEach(user => {
                    connectionScores.set(user, (connectionScores.get(user) || 0) + 1);
                });
            }
            
            // Check issuers used by blacklisted users
            if (reverseChains.has(blacklistedAddr)) {
                reverseChains.get(blacklistedAddr).forEach(issuer => {
                    connectionScores.set(issuer, (connectionScores.get(issuer) || 0) + 1);
                });
            }
        });
        
        // Add high-scoring addresses to suspicious set
        connectionScores.forEach((score, address) => {
            if (score >= 2) { // At least 2 connections to blacklisted addresses
                suspiciousAddresses.add(address);
            }
        });
        
        console.log(`Total suspicious addresses after connection analysis: ${suspiciousAddresses.size}`);
        
        // Filter addresses based on criteria
        const filteredAddresses = [];
        
        suspiciousAddresses.forEach(address => {
            if (!blacklistedWallets.has(address) && 
                (userCodeCount.get(address) || 0) >= 4) {
                filteredAddresses.push(address);
            }
        });
        
        console.log(`Addresses meeting criteria (not in BL.csv and 4+ codes used): ${filteredAddresses.length}`);
        
        // Show distribution
        const codeCountDistribution = {};
        filteredAddresses.forEach(address => {
            const count = userCodeCount.get(address);
            codeCountDistribution[count] = (codeCountDistribution[count] || 0) + 1;
        });
        
        console.log('\nCode usage distribution for filtered addresses:');
        Object.keys(codeCountDistribution).sort((a, b) => parseInt(a) - parseInt(b)).slice(0, 20).forEach(count => {
            console.log(`  ${count} codes: ${codeCountDistribution[count]} addresses`);
        });
        
        // Show connection score distribution for filtered addresses
        const scoreDistribution = {};
        filteredAddresses.forEach(address => {
            const score = connectionScores.get(address) || 0;
            scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;
        });
        
        console.log('\nBlacklisted connection distribution for filtered addresses:');
        Object.keys(scoreDistribution).sort((a, b) => parseInt(a) - parseInt(b)).forEach(score => {
            console.log(`  ${score} blacklisted connections: ${scoreDistribution[score]} addresses`);
        });
        
        // Create output data
        const outputData = filteredAddresses.map(address => ({ address }));
        
        // Write to bl_add.csv
        writeCSV('bl_add.csv', outputData, ['address']);
        
        console.log(`\nAnalysis complete! ${filteredAddresses.length} addresses written to bl_add.csv`);
        
    } catch (error) {
        console.error('Error during analysis:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the analysis
analyzeReferralChains();