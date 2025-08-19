import fs from 'fs';

// CONFIGURATION
const MAX_CONNECTION_DEPTH = 600; // Adjust this value as needed
const ENABLE_DEBUG = true; // Set to false to reduce log output

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
        console.error(`[2025-08-15 13:30:24] Error: File ${filePath} does not exist`);
        return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
        console.error(`[2025-08-15 13:30:24] Error: File ${filePath} is empty`);
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

// Function to find path using BFS (breadth-first search)
function findPathBFS(graph, start, target, maxDepth = MAX_CONNECTION_DEPTH) {
    if (start === target) return [start];
    
    const queue = [[start, [start]]];
    const visited = new Set([start]);
    
    while (queue.length > 0) {
        const [currentNode, path] = queue.shift();
        
        if (path.length > maxDepth) continue;
        
        if (graph.has(currentNode)) {
            for (const neighbor of graph.get(currentNode)) {
                if (neighbor === target) {
                    return [...path, neighbor];
                }
                
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([neighbor, [...path, neighbor]]);
                }
            }
        }
    }
    
    return null;
}

// Main analysis function
function analyzeWalletConnections() {
    try {
        const startTime = Date.now();
        console.log(`[2025-08-15 13:30:24] Starting wallet connection analysis...`);
        console.log(`[2025-08-15 13:30:24] User: noname9006`);
        console.log(`[2025-08-15 13:30:24] Max connection depth: ${MAX_CONNECTION_DEPTH} degrees`);
        
        // Read input files
        console.log(`[2025-08-15 13:30:24] Reading ref_codes.csv...`);
        const refCodes = parseCSV('ref_codes.csv');
        
        console.log(`[2025-08-15 13:30:24] Reading check.csv...`);
        const checkData = parseCSV('check.csv');
        
        if (refCodes.length === 0) {
            console.error(`[2025-08-15 13:30:24] Error: No data found in ref_codes.csv`);
            return;
        }
        
        if (checkData.length === 0) {
            console.error(`[2025-08-15 13:30:24] Error: No data found in check.csv`);
            return;
        }
        
        console.log(`[2025-08-15 13:30:24] Loaded ${refCodes.length} referral codes and ${checkData.length} check entries`);
        
        if (ENABLE_DEBUG) {
            console.log(`[2025-08-15 13:30:24] Sample ref_codes data:`, refCodes[0]);
            console.log(`[2025-08-15 13:30:24] Sample check data:`, checkData[0]);
        }
        
        // Extract wallets to check from check.csv
        const walletsToCheck = new Set();
        const duplicatesFound = [];
        const invalidAddresses = [];
        
        const checkHeaders = Object.keys(checkData[0]);
        console.log(`[2025-08-15 13:30:24] Available columns in check.csv: ${checkHeaders.join(', ')}`);
        
        // Try to find address column (flexible naming)
        const possibleAddressColumns = ['address', 'wallet', 'wallet_address', 'user', 'used_by'];
        let addressColumn = null;
        
        for (const col of possibleAddressColumns) {
            if (checkHeaders.includes(col)) {
                addressColumn = col;
                break;
            }
        }
        
        if (!addressColumn) {
            // Use first column as default
            addressColumn = checkHeaders[0];
            console.log(`[2025-08-15 13:30:24] Warning: No standard address column found, using '${addressColumn}'`);
        } else {
            console.log(`[2025-08-15 13:30:24] Using address column: '${addressColumn}'`);
        }
        
        // Process each entry in check.csv
        checkData.forEach((row, index) => {
            const address = row[addressColumn] ? row[addressColumn].toLowerCase().trim() : '';
            
            if (!address) {
                invalidAddresses.push(`Row ${index + 1}: Empty address`);
                return;
            }
            
            if (isNullAddress(address)) {
                invalidAddresses.push(`Row ${index + 1}: Null/zero address (${address})`);
                return;
            }
            
            if (walletsToCheck.has(address)) {
                duplicatesFound.push(`Row ${index + 1}: Duplicate address (${address})`);
                return;
            }
            
            walletsToCheck.add(address);
        });
        
        console.log(`[2025-08-15 13:30:24] Address processing results:`);
        console.log(`  - Valid unique addresses: ${walletsToCheck.size}`);
        console.log(`  - Invalid addresses: ${invalidAddresses.length}`);
        console.log(`  - Duplicate addresses: ${duplicatesFound.length}`);
        
        if (invalidAddresses.length > 0) {
            console.log(`[2025-08-15 13:30:24] Invalid addresses found:`);
            invalidAddresses.forEach(msg => console.log(`    ${msg}`));
        }
        
        if (duplicatesFound.length > 0) {
            console.log(`[2025-08-15 13:30:24] Duplicate addresses found:`);
            duplicatesFound.forEach(msg => console.log(`    ${msg}`));
        }
        
        console.log(`[2025-08-15 13:30:24] Final wallet list:`, Array.from(walletsToCheck));
        
        if (walletsToCheck.size === 0) {
            console.error(`[2025-08-15 13:30:24] Error: No valid wallet addresses found in check.csv`);
            return;
        }
        
        // Calculate expected number of pairs
        const expectedPairs = (walletsToCheck.size * (walletsToCheck.size - 1)) / 2;
        console.log(`[2025-08-15 13:30:24] Will analyze ${expectedPairs} pairs from ${walletsToCheck.size} wallets`);
        
        // Build UNIFIED referral network from ref_codes.csv
        console.log(`[2025-08-15 13:30:24] Building unified referral network...`);
        
        const graph = new Map(); // wallet -> Set of connected wallets
        const edgeDetails = new Map(); // "wallet1->wallet2" -> {issuer, user, relationship}
        
        let processedCount = 0;
        let nullAddressSkipped = 0;
        let targetWalletsInNetwork = new Set();
        
        refCodes.forEach((code) => {
            const issuer = code['issued_by'] ? code['issued_by'].toLowerCase().trim() : '';
            const user = code['used_by'] ? code['used_by'].toLowerCase().trim() : '';
            const used = code['used'];
            
            // Skip if either address is null/zero address
            if (isNullAddress(issuer) || isNullAddress(user)) {
                nullAddressSkipped++;
                return;
            }
            
            if (issuer && user && used) {
                // Add bidirectional connection (undirected graph)
                if (!graph.has(issuer)) {
                    graph.set(issuer, new Set());
                }
                if (!graph.has(user)) {
                    graph.set(user, new Set());
                }
                
                graph.get(issuer).add(user);
                graph.get(user).add(issuer);
                
                // Store edge details
                const edgeKey1 = `${issuer}->${user}`;
                const edgeKey2 = `${user}->${issuer}`;
                
                edgeDetails.set(edgeKey1, {
                    issuer: issuer,
                    user: user,
                    relationship: 'invited',
                    timestamp: code['timestamp'] || code['created_at'] || code['date'] || ''
                });
                
                edgeDetails.set(edgeKey2, {
                    issuer: user,
                    user: issuer,
                    relationship: 'invited_by',
                    timestamp: code['timestamp'] || code['created_at'] || code['date'] || ''
                });
                
                processedCount++;
                
                // Track target wallets in network
                if (walletsToCheck.has(issuer)) targetWalletsInNetwork.add(issuer);
                if (walletsToCheck.has(user)) targetWalletsInNetwork.add(user);
            }
        });
        
        console.log(`[2025-08-15 13:30:24] Network building results:`);
        console.log(`  - Processed ${processedCount} valid referral connections`);
        console.log(`  - Skipped ${nullAddressSkipped} connections with null addresses`);
        console.log(`  - Total wallets in network: ${graph.size}`);
        console.log(`  - Target wallets found in network: ${targetWalletsInNetwork.size}/${walletsToCheck.size}`);
        
        // Check which target wallets are in the network
        const walletsInNetwork = Array.from(walletsToCheck).filter(wallet => graph.has(wallet));
        const walletsNotInNetwork = Array.from(walletsToCheck).filter(wallet => !graph.has(wallet));
        
        if (walletsNotInNetwork.length > 0) {
            console.log(`[2025-08-15 13:30:24] Target wallets NOT in referral network:`);
            walletsNotInNetwork.forEach(wallet => {
                console.log(`  - ${wallet}`);
            });
        }
        
        if (ENABLE_DEBUG && walletsInNetwork.length > 0) {
            console.log(`[2025-08-15 13:30:24] Network statistics for target wallets:`);
            walletsInNetwork.forEach(wallet => {
                const connections = graph.get(wallet);
                console.log(`  ${wallet}: ${connections.size} direct connections`);
                if (connections.size > 0 && connections.size <= 5) {
                    console.log(`    Connected to: ${Array.from(connections).join(', ')}`);
                }
            });
        }
        
        // Analyze connections between wallets to check
        console.log(`[2025-08-15 13:30:24] Analyzing connections between target wallets...`);
        
        const connectionResults = [];
        const walletsArray = Array.from(walletsToCheck);
        
        let pairsChecked = 0;
        let connectedPairs = 0;
        let directConnections = 0;
        const totalPairs = expectedPairs;
        
        console.log(`[2025-08-15 13:30:24] Starting pair analysis...`);
        
        for (let i = 0; i < walletsArray.length; i++) {
            for (let j = i + 1; j < walletsArray.length; j++) {
                const wallet1 = walletsArray[i];
                const wallet2 = walletsArray[j];
                pairsChecked++;
                
                console.log(`[2025-08-15 13:30:24] Checking pair ${pairsChecked}/${totalPairs}: ${wallet1} <-> ${wallet2}`);
                
                let connectionFound = false;
                let shortestPath = null;
                let connectionType = '';
                let degree = 0;
                
                // Skip if either wallet is not in the network
                if (!graph.has(wallet1) || !graph.has(wallet2)) {
                    const reason = !graph.has(wallet1) && !graph.has(wallet2) ? 
                        'Both wallets not in referral network' :
                        !graph.has(wallet1) ? 
                        `${wallet1} not in referral network` :
                        `${wallet2} not in referral network`;
                    
                    connectionResults.push({
                        wallet1: wallet1,
                        wallet2: wallet2,
                        connected: false,
                        degree: -1,
                        path: reason,
                        connection_type: 'Not in network',
                        path_length: -1
                    });
                    console.log(`  Result: Not connected (${reason})`);
                    continue;
                }
                
                // Check for direct connection first
                if (graph.get(wallet1).has(wallet2)) {
                    connectionFound = true;
                    shortestPath = [wallet1, wallet2];
                    degree = 1;
                    directConnections++;
                    
                    // Determine the relationship direction
                    const edgeKey = `${wallet1}->${wallet2}`;
                    if (edgeDetails.has(edgeKey)) {
                        const details = edgeDetails.get(edgeKey);
                        connectionType = `Direct: ${details.relationship}`;
                    } else {
                        connectionType = 'Direct connection';
                    }
                    console.log(`  Result: Direct connection (1 degree)`);
                } else {
                    // Use BFS to find shortest path
                    shortestPath = findPathBFS(graph, wallet1, wallet2, MAX_CONNECTION_DEPTH);
                    
                    if (shortestPath) {
                        connectionFound = true;
                        degree = shortestPath.length - 1;
                        connectionType = `${degree}-degree connection`;
                        console.log(`  Result: Connected via ${degree} degrees`);
                        console.log(`  Path: ${shortestPath.join(' -> ')}`);
                    } else {
                        console.log(`  Result: No connection found within ${MAX_CONNECTION_DEPTH} degrees`);
                    }
                }
                
                if (connectionFound) {
                    connectedPairs++;
                    connectionResults.push({
                        wallet1: wallet1,
                        wallet2: wallet2,
                        connected: true,
                        degree: degree,
                        path: shortestPath.join(' -> '),
                        connection_type: connectionType,
                        path_length: shortestPath.length
                    });
                } else {
                    connectionResults.push({
                        wallet1: wallet1,
                        wallet2: wallet2,
                        connected: false,
                        degree: -1,
                        path: `No path found within ${MAX_CONNECTION_DEPTH} degrees`,
                        connection_type: 'Disconnected',
                        path_length: -1
                    });
                }
            }
        }
        
        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`[2025-08-15 13:30:24] Connection analysis complete in ${elapsedTime.toFixed(1)} seconds`);
        
        // Generate statistics
        console.log(`[2025-08-15 13:30:24] Connection Analysis Results:`);
        console.log(`  - Total wallet pairs analyzed: ${totalPairs} (expected: ${expectedPairs})`);
        console.log(`  - Connected pairs: ${connectedPairs} (${((connectedPairs/totalPairs)*100).toFixed(1)}%)`);
        console.log(`  - Direct connections (1-degree): ${directConnections}`);
        console.log(`  - Disconnected pairs: ${(totalPairs - connectedPairs)}`);
        
        // Degree distribution
        const degreeDistribution = {};
        connectionResults.filter(r => r.connected).forEach(result => {
            degreeDistribution[result.degree] = (degreeDistribution[result.degree] || 0) + 1;
        });
        
        if (Object.keys(degreeDistribution).length > 0) {
            console.log(`[2025-08-15 13:30:24] Connection degree distribution:`);
            Object.keys(degreeDistribution).sort((a, b) => parseInt(a) - parseInt(b)).forEach(degree => {
                console.log(`  ${degree}-degree: ${degreeDistribution[degree]} connections`);
            });
        }
        
        // Show all connections (since we likely have a small number)
        if (connectedPairs > 0) {
            console.log(`[2025-08-15 13:30:24] All connections found:`);
            connectionResults.filter(r => r.connected).forEach((result, index) => {
                console.log(`  ${index + 1}. ${result.wallet1} <-> ${result.wallet2}: ${result.degree}-degree`);
                console.log(`     Path: ${result.path}`);
                console.log(`     Type: ${result.connection_type}`);
            });
        } else {
            console.log(`[2025-08-15 13:30:24] No connections found between target wallets!`);
        }
        
        // Write results
        writeCSV('connection_results.csv', connectionResults, [
            'wallet1', 'wallet2', 'connected', 'degree', 'path', 'connection_type', 'path_length'
        ]);
        
        writeCSV('connection_summary.csv', [
            { metric: 'Max connection depth', value: MAX_CONNECTION_DEPTH },
            { metric: 'Total wallets analyzed', value: walletsToCheck.size },
            { metric: 'Wallets found in network', value: walletsInNetwork.length },
            { metric: 'Wallets missing from network', value: walletsNotInNetwork.length },
            { metric: 'Total pairs checked', value: totalPairs },
            { metric: 'Connected pairs', value: connectedPairs },
            { metric: 'Connection rate (%)', value: totalPairs > 0 ? ((connectedPairs/totalPairs)*100).toFixed(2) : '0' },
            { metric: 'Direct connections', value: directConnections },
            { metric: 'Analysis time (seconds)', value: elapsedTime.toFixed(1) }
        ], ['metric', 'value']);
        
        console.log(`[2025-08-15 13:30:24] Analysis complete! Files written: connection_results.csv, connection_summary.csv`);
        
    } catch (error) {
        console.error(`[2025-08-15 13:30:24] Error during analysis:`, error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the analysis
analyzeWalletConnections();