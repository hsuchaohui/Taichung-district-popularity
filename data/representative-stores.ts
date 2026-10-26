export interface RepresentativeStore {
  placeId: string;
  name: string;
  category: string;
}

// Rebuilt from analysis/representative-stores-2026-09-03/google-verification.csv (Google check on 2026-09-03).
export const representativeStoresByDistrict: Record<string, RepresentativeStore[]> = {
  fengjia: [
    { placeId: "ChIJRw_ShSEWaTQRJOy8z1Z6woI", name: "明倫蛋餅 逢甲福星店", category: "小吃" },
    { placeId: "ChIJX4EYAyMWaTQRG3VgBydiZFg", name: "官芝霖大腸包小腸", category: "小吃" },
    { placeId: "ChIJXwQ5SCIWaTQR3tIg68emIqU", name: "一心素食臭豆腐", category: "素食小吃" },
    { placeId: "ChIJRw_ShSEWaTQRdzGvKqfl7Xw", name: "日船章魚小丸子（逢甲總店）", category: "小吃" },
    { placeId: "ChIJbYemqSMWaTQRH9o8Cznfgz0", name: "溫家老店正宗逢甲地瓜球", category: "甜點小吃" },
    { placeId: "ChIJu8f7zyMWaTQRYlBpRJIM1Zg", name: "阿華黑輪店（創始店 路邊攤）", category: "關東煮" },
    { placeId: "ChIJ9e6JOnYXaTQRLGH8PhtMTdc", name: "刁民-酸菜魚 逢甲店", category: "中式餐飲" },
    { placeId: "ChIJhYGC5TwWaTQRtFw0QBzL44s", name: "激旨燒き鳥Gekiuma Yakitori 台灣總店", category: "日式串燒" },
    { placeId: "ChIJB55rSSIWaTQRsoxtMvwPzWE", name: "大甲芋頭城逢甲店", category: "冰品甜湯" },
    { placeId: "ChIJf4ES-CIWaTQRW__4suodnE0", name: "光南大批發台中逢甲店", category: "文具百貨" },
  ],
  yizhong: [
    { placeId: "ChIJJ64IUWg9aTQRHHEx8oENpfU", name: "一中豐仁冰", category: "傳統冰品" },
    { placeId: "ChIJpQ3NH2k9aTQRGr4PoO9oG2Q", name: "一中豪大雞排", category: "炸物小吃" },
    { placeId: "ChIJCf_G5Wg9aTQRPUmJrVZox4Q", name: "阿月紅茶冰 (愛廣場)", category: "茶飲" },
    { placeId: "ChIJO_EIqGk9aTQRhcp-0DaUgH8", name: "盧の堡半月燒餡餅一中直營店", category: "小吃" },
    { placeId: "ChIJsSj7Pmk9aTQR10QeXH-bHeQ", name: "王印製麵麻辣乾麵", category: "麵食" },
    { placeId: "ChIJAS4w72g9aTQREQh5diIRoso", name: "上和園滷味", category: "冷滷味" },
    { placeId: "ChIJL55X7Gg9aTQRxcLZc8VOoAA", name: "一中街打餅舖烙餅", category: "烙餅小吃" },
    { placeId: "ChIJnf18xGg9aTQRmjYlRZ4SPfs", name: "HUN混 義大利麵 一中店", category: "義式餐飲" },
    { placeId: "ChIJR5Y-L2k9aTQRx34Ck41s_WM", name: "墊腳石圖書文化廣場 台中旗艦店", category: "書店文具" },
    { placeId: "ChIJzThsImY9aTQRGbowpXZD52M", name: "誠品生活中友店", category: "書店" },
  ],
  calligraphy: [
    { placeId: "ChIJH4Yn2J09aTQR6zgTkm50h2s", name: "誠品生活園道店", category: "書店" },
    { placeId: "ChIJIWTVhJ49aTQRwGo-yxZfHFQ", name: "茉莉二手書店", category: "二手書店" },
    { placeId: "ChIJXfm2lU89aTQRUpgofvCt1tU", name: "小日子商號 審計店", category: "文創選物" },
    { placeId: "ChIJCUReNbI9aTQRbyOqNGBUyyY", name: "成真咖啡Cometrue 台中審計店(創始店）", category: "咖啡餐飲" },
    { placeId: "ChIJR22T9-M9aTQRKh84Xzi-S3A", name: "旅禾烘焙 美村旗艦店", category: "烘焙" },
    { placeId: "ChIJw4b6vaE9aTQRmkMk98MUnaA", name: "美軍豆乳冰", category: "豆乳冰品" },
    { placeId: "ChIJo8n9wJ49aTQRlLh1gGOeYnk", name: "美村點頭冰", category: "傳統冰品" },
    { placeId: "ChIJ_-dqe3U9aTQR4Jy50r8M5cs", name: "模範貝果MOFAN BAGELS", category: "手作烘焙" },
    { placeId: "ChIJOZP7Up49aTQRcAe1TIgWYwg", name: "Haritts Donuts & Coffee", category: "甜甜圈咖啡" },
    { placeId: "ChIJVzXv3VM9aTQRPHXsUlb78Q8", name: "春水堂 勤美誠品店", category: "茶館餐飲" },
  ],
  gongyi: [
    { placeId: "ChIJTeBTY5c9aTQRBxv5dLXr4kE", name: "輕井澤 公益店", category: "個人鍋物" },
    { placeId: "ChIJJ6o8Qtg9aTQRdPMUo5sVQYY", name: "茶六燒肉堂 公益店", category: "日式燒肉" },
    { placeId: "ChIJuQq4-JY9aTQRZLpsXEkkIdE", name: "鼎王麻辣鍋(台中公益店)", category: "麻辣火鍋" },
    { placeId: "ChIJzd0pX5Y9aTQRyHvJVjVVUjM", name: "無老鍋(台中公益店)", category: "鍋物" },
    { placeId: "ChIJnUv6vJk9aTQRtCvxAB4mU_Y", name: "俺達の肉屋 日本和牛燒肉店", category: "燒肉" },
    { placeId: "ChIJWSHplpc9aTQROgmIgGRwQzI", name: "元手公益", category: "日本料理" },
    { placeId: "ChIJb2HzTI49aTQRE75UtLOPrEA", name: "一笈壽司", category: "日本料理" },
    { placeId: "ChIJxypaa-I9aTQRXpXwdg2xoPA", name: "享鴨台中公益店", category: "烤鴨中菜" },
    { placeId: "ChIJ8UhrSZU9aTQROScVBtpYMrE", name: "傑克兄弟牛排館 臺中公益店", category: "美式牛排" },
    { placeId: "ChIJ9U2YcsI9aTQR7fBVMRKGF0k", name: "滬舍餘味", category: "上海點心" },
  ],
};

const representativePlaceIds = new Set(
  Object.values(representativeStoresByDistrict).flatMap((stores) => stores.map((store) => store.placeId)),
);

export function isRepresentativePlaceId(placeId: string): boolean {
  return representativePlaceIds.has(placeId);
}
