let FaultType = {
    NO_START: 'NO_START',
    NO_END: 'NO_END',
    IMPLICIT_START: 'IMPLICIT_START',
    IMPLICIT_END: 'IMPLICIT_END',
    GATEWAY_WITHOUT_MULTIPLE_FLOWS: 'GATEWAY_WITHOUT_MULTIPLE_FLOWS',
    LOOP_EXIT_NOT_XOR: 'LOOP_EXIT_NOT_XOR',
    LOOP_ENTRY_IS_AND: 'LOOP_ENTRY_IS_AND',
    LOOP_BACK_JOIN_IS_AND: 'LOOP_BACK_JOIN_IS_AND',
    POTENTIAL_DEADLOCK: 'POTENTIAL_DEADLOCK',
    POTENTIAL_LACK_OF_SYNCHRONIZATION: 'POTENTIAL_LACK_OF_SYNCHRONIZATION'
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