"use strict";
/**
 * Compute the set intersection of s1 and s2.
 * @param s1 The object representing set 1.
 * @param s2 The object representing set 2.
 * @returns {{}}
 */
let intersect = function (s1, s2) {
    let k1 = Object.keys(s1), k2 = Object.keys(s2);
    return k1.filter(x => k2.includes(x)).reduce((s,k) => {
        s[k] = s1[k];
        return s;
    }, {});
};

/**
 * Compute the set minus (difference) of s1 and s2.
 * @param s1 The object representing set 1.
 * @param s2 The object representing set 2.
 * @returns {{}}
 */
let diff = function (s1, s2) {
    let k1 = Object.keys(s1), k2 = Object.keys(s2);
    return k1.filter(x => !k2.includes(x)).reduce((s,k) => {
        s[k] = s1[k];
        return s;
    }, {});
};

/**
 * Compute the set union of s1 and s2.
 * @param s1 The object representing set 1.
 * @param s2 The object representing set 2.
 * @returns {{}}
 */
let union = function (s1, s2) {
    return Object.assign({}, s2, s1);
};

/**
 * Makes an array (or list) out of a set.
 * @param s The object representing the set.
 * @returns []
 */
let asList = function (s) {
    return Object.values(s);
};

/**
 * Makes a set out of an array.
 * @param l The list to be represented as set.
 * @returns {*}
 */
let asObject = function (l) {
    return l.reduce((o,i) => { o[i.getId] = i; return o; }, {});
};

/**
 * Checks if the given variable represents an object.
 * @param o The possible object.
 * @returns {boolean}
 */
let isObject = function (o) {
    return typeof o === 'object';
};

/**
 * Checks if the given set is empty.
 * @param s The object representing the set.
 * @returns {boolean}
 */
let isEmpty = function (s) {
    return Object.keys(s).length === 0;
};


export { intersect, diff, union, asList, asObject, isObject, isEmpty };