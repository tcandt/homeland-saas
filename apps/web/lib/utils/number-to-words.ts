export const numberToWordsVietnamese = (n: number): string => {
  if (n === 0) return "Không đồng";
  const str = n.toString();
  const mangGiaTriVn = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ", "tỷ tỷ"];
  const chuSoVn = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  let kq = "";
  let block = str.length % 3 === 0 ? Math.floor(str.length / 3) : Math.floor(str.length / 3) + 1;
  let len = str.length;
  const docSo = (so: string, full: boolean) => {
    let s = "";
    const t = parseInt(so[0] || "0"), c = parseInt(so[1] || "0"), d = parseInt(so[2] || "0");
    if (t > 0 || full) s += chuSoVn[t] + " trăm ";
    if (c > 0 && c !== 1) s += chuSoVn[c] + " mươi ";
    if (c === 1) s += "mười ";
    if (c === 0 && d > 0 && (t > 0 || full)) s += "lẻ ";
    if (d === 1 && c > 1) s += "mốt ";
    else if (d === 5 && c > 0) s += "lăm ";
    else if (d > 0) s += chuSoVn[d] + " ";
    return s;
  };
  for (let i = 0; i < block; i++) {
    const sl = len - (block - i - 1) * 3;
    let s = str.substring(len - (block - i) * 3, sl);
    if (s.length < 3 && i === 0) s = s.padStart(3, "0");
    if (parseInt(s) > 0) kq += docSo(s, i > 0) + mangGiaTriVn[block - i - 1] + " ";
  }
  kq = kq.trim().replace(/\s+/g, " ");
  if (kq) {
    kq += " đồng";
    if (n % 1000 === 0) {
      kq += " chẵn";
    }
  }
  return kq.charAt(0).toUpperCase() + kq.slice(1);
};
