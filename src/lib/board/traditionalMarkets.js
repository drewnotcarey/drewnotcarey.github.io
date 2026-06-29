// Traditional market universe — expanded with themes from the original Stable Market Board
// Sources: Lighter (214 markets) + OKX SWAP perps (7 tradfi tickers)
// Updated: June 2026 — 53 assets across 17 themes

export const TRAD_UNIVERSE = [
  // Benchmark
  { symbol: 'SPY',    name: 'SPDR S&P 500 ETF',                         category: 'Benchmark',                  subtheme: 'Index',                 type: 'ETF' },
  { symbol: 'QQQ',    name: 'Invesco QQQ',                              category: 'Benchmark',                  subtheme: 'Index',                 type: 'ETF' },
  { symbol: 'IWM',    name: 'iShares Russell 2000 ETF',                 category: 'Benchmark',                  subtheme: 'Index',                 type: 'ETF' },
  { symbol: 'DIA',    name: 'SPDR Dow Jones Industrial ETF',            category: 'Benchmark',                  subtheme: 'Index',                 type: 'ETF' },
  // AI Infrastructure
  { symbol: 'NVDA',   name: 'NVIDIA',                                   category: 'AI Infrastructure',          subtheme: 'GPU',                   type: 'Stock' },
  { symbol: 'AMD',    name: 'Advanced Micro Devices',                   category: 'AI Infrastructure',          subtheme: 'GPU/CPU',               type: 'Stock' },
  { symbol: 'AVGO',   name: 'Broadcom',                                 category: 'AI Infrastructure',          subtheme: 'Networking/ASIC',       type: 'Stock' },
  { symbol: 'MRVL',   name: 'Marvell Technology',                       category: 'AI Infrastructure',          subtheme: 'Networking/ASIC',       type: 'Stock' },
  { symbol: 'DELL',   name: 'Dell Technologies',                        category: 'AI Infrastructure',          subtheme: 'Servers',               type: 'Stock' },
  { symbol: 'ARM',    name: 'Arm Holdings',                             category: 'AI Infrastructure',          subtheme: 'IP/Architecture',       type: 'Stock' },
  { symbol: 'TSM',    name: 'Taiwan Semiconductor',                     category: 'AI Infrastructure',          subtheme: 'Foundry',               type: 'Stock' },
  { symbol: 'CRWV',   name: 'CoreWeave',                                category: 'AI Infrastructure',          subtheme: 'GPU Cloud',             type: 'Stock' },
  { symbol: 'NBIS',   name: 'Nebius Group',                             category: 'AI Infrastructure',          subtheme: 'GPU Cloud',             type: 'Stock' },
  // AI Applications
  { symbol: 'MSFT',   name: 'Microsoft',                                category: 'AI Applications',            subtheme: 'Cloud/AI',              type: 'Stock' },
  { symbol: 'GOOGL',  name: 'Alphabet',                                 category: 'AI Applications',            subtheme: 'Search/AI',             type: 'Stock' },
  { symbol: 'META',   name: 'Meta Platforms',                           category: 'AI Applications',            subtheme: 'Social/AI',             type: 'Stock' },
  { symbol: 'AMZN',   name: 'Amazon',                                   category: 'AI Applications',            subtheme: 'Cloud/AI',              type: 'Stock' },
  { symbol: 'AAPL',   name: 'Apple',                                    category: 'AI Applications',            subtheme: 'Devices/AI',            type: 'Stock' },
  { symbol: 'ORCL',   name: 'Oracle',                                   category: 'AI Applications',            subtheme: 'Cloud/AI',              type: 'Stock' },
  { symbol: 'PLTR',   name: 'Palantir',                                 category: 'AI Applications',            subtheme: 'Enterprise AI',         type: 'Stock' },
  { symbol: 'IBM',    name: 'IBM',                                      category: 'AI Applications',            subtheme: 'Enterprise AI',         type: 'Stock' },
  // Semiconductors
  { symbol: 'ASML',   name: 'ASML Holding',                             category: 'Semiconductors',             subtheme: 'Equipment',             type: 'Stock' },
  { symbol: 'INTC',   name: 'Intel',                                    category: 'Semiconductors',             subtheme: 'CPU/Foundry',           type: 'Stock' },
  { symbol: 'QCOM',   name: 'Qualcomm',                                 category: 'Semiconductors',             subtheme: 'Mobile/Modem',          type: 'Stock' },
  { symbol: 'SOXL',   name: 'Direxion Semis 3x Bull',                   category: 'Semiconductors',             subtheme: 'Leveraged ETF',         type: 'ETF' },
  { symbol: 'SOXX',   name: 'iShares Semiconductor ETF',                category: 'Semiconductors',             subtheme: 'ETF',                   type: 'ETF' },
  // Optics
  { symbol: 'LITE',   name: 'Lumentum',                                 category: 'Optics',                     subtheme: 'Optical Components',    type: 'Stock' },
  { symbol: 'AAOI',   name: 'Applied Optoelectronics',                  category: 'Optics',                     subtheme: 'Optical Modules',       type: 'Stock' },
  // Memory
  { symbol: 'MU',     name: 'Micron Technology',                        category: 'Memory',                     subtheme: 'DRAM/HBM',              type: 'Stock' },
  { symbol: 'SNDK',   name: 'SanDisk',                                  category: 'Memory',                     subtheme: 'Flash/NAND',            type: 'Stock' },
  // Software Infrastructure
  { symbol: 'S',      name: 'SentinelOne',                              category: 'Software Infrastructure',    subtheme: 'Security',              type: 'Stock' },
  { symbol: 'NOW',    name: 'ServiceNow',                               category: 'Software Infrastructure',    subtheme: 'Enterprise SaaS',       type: 'Stock' },
  // Crypto Equities
  { symbol: 'COIN',   name: 'Coinbase',                                 category: 'Crypto Equities',            subtheme: 'Exchange',              type: 'Stock' },
  { symbol: 'MSTR',   name: 'Strategy',                                 category: 'Crypto Equities',            subtheme: 'BTC Treasury',          type: 'Stock' },
  { symbol: 'HOOD',   name: 'Robinhood',                                category: 'Crypto Equities',            subtheme: 'Brokerage',             type: 'Stock' },
  { symbol: 'CRCL',   name: 'Circle',                                   category: 'Crypto Equities',            subtheme: 'Stablecoin Issuer',     type: 'Stock' },
  // Robotics
  { symbol: 'TSLA',   name: 'Tesla',                                    category: 'Robotics',                   subtheme: 'EV/Humanoid',           type: 'Stock' },
  { symbol: 'ROBO',   name: 'ROBO Global Robotics',                     category: 'Robotics',                   subtheme: 'Robotics ETF',          type: 'ETF' },
  // Defense
  { symbol: 'RKLB',   name: 'Rocket Lab',                               category: 'Defense',                    subtheme: 'Space',                 type: 'Stock' },
  // Nuclear
  { symbol: 'URA',    name: 'Global X Uranium ETF',                     category: 'Nuclear',                    subtheme: 'ETF',                   type: 'ETF' },
  // Power/Grid
  { symbol: 'BE',     name: 'Bloom Energy',                             category: 'Power/Grid',                 subtheme: 'Fuel Cells',            type: 'Stock' },
  // Energy
  { symbol: 'WTI',    name: 'Crude Oil WTI',                            category: 'Energy',                     subtheme: 'Oil',                   type: 'Stock' },
  // Metals
  { symbol: 'XCU',    name: 'Copper',                                   category: 'Metals',                     subtheme: 'Copper',                type: 'Stock' },
  { symbol: 'XPD',    name: 'Palladium',                                category: 'Metals',                     subtheme: 'Palladium',             type: 'Stock' },
  { symbol: 'XPT',    name: 'Platinum',                                 category: 'Metals',                     subtheme: 'Platinum',              type: 'Stock' },
  // China Tech
  { symbol: 'BABA',   name: 'Alibaba',                                  category: 'China Tech',                 subtheme: 'China Internet',        type: 'Stock' },
  { symbol: 'EWY',    name: 'iShares MSCI South Korea ETF',             category: 'China Tech',                 subtheme: 'Korea ETF',             type: 'ETF' },
  // Consumer Momentum
  { symbol: 'DASH',   name: 'DoorDash',                                 category: 'Consumer Momentum',          subtheme: 'Delivery',              type: 'Stock' },
  { symbol: 'GME',    name: 'GameStop',                                 category: 'Consumer Momentum',          subtheme: 'Meme Stock',            type: 'Stock' },
  { symbol: 'TTWO',   name: 'Take-Two Interactive',                     category: 'Consumer Momentum',          subtheme: 'Gaming',                type: 'Stock' },
  // Telecom
  { symbol: 'NOK',    name: 'Nokia',                                    category: 'Telecom',                    subtheme: '5G/Network',            type: 'Stock' },
  // Other
  { symbol: 'MAGS',   name: 'VanEck Agribusiness ETF',                  category: 'Other',                      subtheme: 'Agriculture ETF',       type: 'ETF' },
];

