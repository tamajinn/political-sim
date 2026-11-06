import type { Block, Ideology, Region } from "../types";

/** 旧ゲーム(legacy/election-sim-v2.html)のマスターデータを移植。 */
export const BLOCKS: Block[] = [
  { id: "hokkaido", name: "北海道", prSeats: 8 },
  { id: "tohoku", name: "東北", prSeats: 12 },
  { id: "n_kanto", name: "北関東", prSeats: 19 },
  { id: "s_kanto", name: "南関東", prSeats: 23 },
  { id: "tokyo", name: "東京", prSeats: 19 },
  { id: "hokuriku", name: "北陸信越", prSeats: 10 },
  { id: "tokai", name: "東海", prSeats: 21 },
  { id: "kinki", name: "近畿", prSeats: 28 },
  { id: "chugoku", name: "中国", prSeats: 10 },
  { id: "shikoku", name: "四国", prSeats: 6 },
  { id: "kyushu", name: "九州", prSeats: 20 },
];

// [id, 名前, ブロック, 小選挙区数, 人口(千人), econ, diplo, social]
type Row = [string, string, string, number, number, number, number, number];
const ROWS: Row[] = [
  ["hokkaido", "北海道", "hokkaido", 12, 520, -20, -10, -15],
  ["aomori", "青森", "tohoku", 3, 125, -10, 20, 35],
  ["iwate", "岩手", "tohoku", 3, 122, -20, 10, 25],
  ["miyagi", "宮城", "tohoku", 5, 231, -5, 10, 10],
  ["akita", "秋田", "tohoku", 3, 96, -15, 25, 40],
  ["yamagata", "山形", "tohoku", 3, 107, -20, 20, 35],
  ["fukushima", "福島", "tohoku", 4, 185, -10, 15, 20],
  ["ibaraki", "茨城", "n_kanto", 7, 287, 15, 20, 30],
  ["tochigi", "栃木", "n_kanto", 5, 194, 10, 20, 25],
  ["gunma", "群馬", "n_kanto", 5, 194, 20, 25, 35],
  ["saitama", "埼玉", "n_kanto", 16, 735, 0, 5, 0],
  ["chiba", "千葉", "s_kanto", 14, 628, -5, -5, -10],
  ["kanagawa", "神奈川", "s_kanto", 20, 924, -10, -15, -20],
  ["yamanashi", "山梨", "s_kanto", 2, 81, 10, 15, 20],
  ["tokyo", "東京", "tokyo", 30, 1408, -15, -35, -45],
  ["niigata", "新潟", "hokuriku", 5, 220, 5, 30, 40],
  ["toyama", "富山", "hokuriku", 3, 104, 15, 40, 50],
  ["ishikawa", "石川", "hokuriku", 3, 113, 10, 35, 45],
  ["fukui", "福井", "hokuriku", 2, 77, 20, 45, 55],
  ["nagano", "長野", "hokuriku", 5, 203, -5, 20, 25],
  ["gifu", "岐阜", "tokai", 5, 199, 10, 15, 20],
  ["shizuoka", "静岡", "tokai", 8, 365, 5, 10, 10],
  ["aichi", "愛知", "tokai", 16, 751, 5, 5, 5],
  ["mie", "三重", "tokai", 4, 178, 0, 10, 10],
  ["shiga", "滋賀", "kinki", 3, 141, -10, -5, -5],
  ["kyoto", "京都", "kinki", 6, 258, -20, -15, -20],
  ["osaka", "大阪", "kinki", 19, 882, -25, -10, -20],
  ["hyogo", "兵庫", "kinki", 12, 547, -10, -5, -10],
  ["nara", "奈良", "kinki", 3, 132, 10, 5, 10],
  ["wakayama", "和歌山", "kinki", 2, 92, 20, 20, 30],
  ["tottori", "鳥取", "chugoku", 2, 55, 25, 50, 60],
  ["shimane", "島根", "chugoku", 2, 67, 30, 55, 65],
  ["okayama", "岡山", "chugoku", 4, 190, 20, 40, 50],
  ["hiroshima", "広島", "chugoku", 6, 280, 15, 35, 40],
  ["yamaguchi", "山口", "chugoku", 3, 136, 25, 50, 55],
  ["tokushima", "徳島", "shikoku", 2, 72, 20, 35, 45],
  ["kagawa", "香川", "shikoku", 3, 95, 15, 30, 40],
  ["ehime", "愛媛", "shikoku", 3, 135, 20, 30, 40],
  ["kochi", "高知", "shikoku", 2, 70, 10, 25, 30],
  ["fukuoka", "福岡", "kyushu", 11, 511, 0, 20, 15],
  ["saga", "佐賀", "kyushu", 2, 82, 15, 35, 40],
  ["nagasaki", "長崎", "kyushu", 3, 131, 5, 30, 35],
  ["kumamoto", "熊本", "kyushu", 4, 176, 10, 30, 30],
  ["oita", "大分", "kyushu", 3, 113, 5, 25, 25],
  ["miyazaki", "宮崎", "kyushu", 3, 107, 10, 30, 35],
  ["kagoshima", "鹿児島", "kyushu", 4, 160, 15, 35, 40],
  ["okinawa", "沖縄", "kyushu", 4, 147, -30, -20, -15],
];

export const REGIONS: Region[] = ROWS.map(([id, name, blockId, smdSeats, population, econ, diplo, social]) => ({
  id, name, blockId, smdSeats, population, ideology: { econ, diplo, social },
}));

export interface PartyTemplate {
  id: string;
  name: string;
  color: string;
  ideology: Ideology;
  fame: number;
  funds: number;
}

export const PARTY_TEMPLATES: PartyTemplate[] = [
  { id: "jimin", name: "自由民政党", color: "#1d4ed8", ideology: { econ: 40, diplo: 60, social: 60 }, fame: 95, funds: 5000 },
  { id: "rikken", name: "立憲改革党", color: "#0891b2", ideology: { econ: -50, diplo: -40, social: -60 }, fame: 88, funds: 2500 },
  { id: "ishin", name: "維新の会", color: "#f59e0b", ideology: { econ: -20, diplo: 10, social: -10 }, fame: 82, funds: 1800 },
];

/** 旧ゲームの calcMatch を移植。3軸ユークリッド距離を [0,1] に正規化した相性。 */
export function ideologyMatch(a: Ideology, b: Ideology): number {
  const d = Math.sqrt((a.econ - b.econ) ** 2 + (a.diplo - b.diplo) ** 2 + (a.social - b.social) ** 2);
  return 1 - d / Math.sqrt(3 * 200 * 200);
}
