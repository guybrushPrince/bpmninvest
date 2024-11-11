let FaultType = {
    NO_START: 'NO_START',
    NO_END: 'NO_END',
    IMPLICIT_START: 'IMPLICIT_START',
    IMPLICIT_END: 'IMPLICIT_END'
};

let faultBus = (function () {
    function FaultBus() {
        this.addInfo = function (process, elements, fault) {
            console.log([process, elements, fault]);
        };
        this.addWarning = function (process, elements, fault) {
            console.log([process, elements, fault]);
        };
        this.addError = function (process, elements, fault) {
            console.log([process, elements, fault]);
        };
    }
    return new FaultBus();
})();