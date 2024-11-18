let intersect = function (s1, s2) {
    let k1 = Object.keys(s1), k2 = Object.keys(s2);
    return k1.filter(x => k2.includes(x)).reduce((s,k) => {
        s[k] = s1[k];
        return s;
    }, {});
};
let diff = function (s1, s2) {
    let k1 = Object.keys(s1), k2 = Object.keys(s2);
    return k1.filter(x => !k2.includes(x)).reduce((s,k) => {
        s[k] = s1[k];
        return s;
    }, {});
};
let union = function (s1, s2) {
    return Object.assign({}, s2, s1);
};