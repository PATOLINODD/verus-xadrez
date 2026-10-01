export function getComplementaryColor(color) {
    if(color >= 360 || color <= 0) return 180;
    return color < 240 ? color + 180 : color - 180;
}