# BLACKLISTER9000

**Cryptocurrency Wallet Blacklist Analysis Tools for Referral Chain Detection**

BLACKLISTER9000 is a set of JavaScript tools for analyzing blockchain wallet data with a particular focus on blacklisting, referral chain detection, and suspicious wallet identification. It enables investigators, analysts, and enthusiasts to map out networks of wallets—finding addresses associated with known blacklisted accounts and identifying potentially suspicious ones through referral patterns.

## Features

- **Referral Chain Analysis:** Detects wallets connected to blacklisted addresses within a configurable number of hops.
- **Suspicious Address Detection:** Flags wallets linked to multiple blacklisted addresses or exhibiting concerning behaviors.
- **CSV Data Handling:** Reads and processes wallet data from CSV files (e.g., `ref_codes.csv` and `BL.csv`).
- **Customizable Analysis:** Several scripts providing different views, analyses, and detection strategies for wallet networks.

## Usage

1. **Install dependencies** (if any are added in future - currently uses Node.js built-in modules):
   ```sh
   npm install
   ```

2. **Prepare your data.**
   - Place your input files (`ref_codes.csv`, `BL.csv`, etc.) in the repository folder.

3. **Run an analysis script.**
   - Standard analysis:
     ```sh
     npm run analyze
     ```
   - Alternative analyses:
     ```sh
     npm run analyze2
     npm run analyze3
     ```

4. **Review output.**
   - The tools print their findings to the console and may write reports as CSV files as configured in the scripts.

---

## Detailed Script Explanations

### `blacklister.js`

**Purpose:**  
Performs comprehensive analysis of wallet addresses through referral chains to detect suspicious or blacklisted activity.

**How it works:**
- Reads referral code data (from `ref_codes.csv`) and known blacklists (from `BL.csv`).
- Builds a network (chains) of who referred whom.
- Finds suspicious addresses by:
  - Tracing (up to 2 “hops”) from blacklisted wallets to their direct/indirect connections.
  - Scoring addresses by how often they interact with blacklisted ones.
  - Filtering for addresses that aren’t blacklisted but exhibit high-risk behavior (e.g., used 4+ codes).
- Outputs statistics on processed addresses, detected chains, and flagged suspicious wallets.

---

### `blacklister2.js`

**Purpose:**  
Analyzes deep wallet connections using network theory, specifically breadth-first search (BFS).

**How it works:**
- Loads referral code data from `ref_codes.csv`.
- Implements a BFS algorithm to explore the connections between addresses in the referral network, searching for specific paths or analyzing the overall connectivity.
- Allows configurable search depth (`MAX_CONNECTION_DEPTH`), enabling deep dive analyses into complex networks of wallets.
- Outputs encountered paths, connection statistics, or results of particular connection queries, which can be used for risk assessment or fraud ring detection.

---

### `blacklister3.js`

**Purpose:**  
Focuses on detecting suspicious "issuers"—wallets that generate many referral codes in a short period, which could indicate automated or fraudulent behavior.

**How it works:**
- Loads and parses referral code data from `ref_codes.csv`.
- Looks for issuers who create 2 or more codes within a 5-minute window (configurable).
- Parses and interprets various date formats to ensure accurate timing analysis.
- Flags accounts fitting the suspicious pattern for further review.

---

## Typical Workflow

1. Gather wallet activity/referral code CSVs.
2. Place them alongside the scripts.
3. Run the preferred analysis script.
4. Inspect the console log and any output files for suspicious wallets or addresses for further review.

## Requirements

- Node.js (latest LTS recommended)
- Input CSV files in the expected formats

## License

ISC © noname9006

## Author

[noname9006](https://github.com/noname9006)

---

*This project is for blockchain analytics and research. Please use responsibly.*