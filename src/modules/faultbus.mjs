/**
 * Fault types.
 */
const FaultType = {
    NO_START: 'NO_START',
    NO_END: 'NO_END',
    IMPLICIT_START: 'IMPLICIT_START',
    IMPLICIT_END: 'IMPLICIT_END',
    GATEWAY_WITHOUT_MULTIPLE_FLOWS: 'GATEWAY_WITHOUT_MULTIPLE_FLOWS',
    LOOP_EXIT_NOT_XOR: 'LOOP_EXIT_NOT_XOR',
    LOOP_ENTRY_IS_AND: 'LOOP_ENTRY_IS_AND',
    LOOP_BACK_JOIN_IS_AND: 'LOOP_BACK_JOIN_IS_AND',
    POTENTIAL_DEADLOCK: 'POTENTIAL_DEADLOCK',
    POTENTIAL_LACK_OF_SYNCHRONIZATION: 'POTENTIAL_LACK_OF_SYNCHRONIZATION',
    POTENTIAL_ENDLESS_LOOP: 'POTENTIAL_ENDLESS_LOOP',
    LIVE_LOCK: 'LIVE_LOCK',
    DEAD_LOOP: 'DEAD_LOOP'
};

const FAULT_LEVEL = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error'
};

/**
 * Export a fault bus.
 * @type {FaultBus}
 */
const faultBus = (function () {
    function FaultBus() {
        this.observers = []; // Array to store observers

        // Notify observers about fault
        this.addInfo = function (process, elements, fault) {
            console.log(FAULT_LEVEL.INFO, [process, elements, fault]);
            this.notify(FAULT_LEVEL.INFO, process, elements, fault);
        };

        this.addWarning = function (process, elements, fault) {
            console.log(FAULT_LEVEL.WARNING, [process, elements, fault]);
            this.notify(FAULT_LEVEL.WARNING, process, elements, fault);
        };

        this.addError = function (process, elements, fault) {
            console.log(FAULT_LEVEL.ERROR, [process, elements, fault]);
            this.notify(FAULT_LEVEL.ERROR, process, elements, fault);
        };

        // Add an observer
        this.subscribe = function (ob) {
            this.observers.push(ob);
        };

        // Remove an observer
        this.unsubscribe = function (ob) {
            this.observers = this.observers.filter((observer) => observer !== ob);
        };

        // Notify all observers
        this.notify = function (type, process, elements, fault) {
            this.observers.forEach(observer => {
                observer.notify(type, process, elements, fault);
            });
        };
        this.clear = function () {
            this.observers = [];
        };
    }
    return new FaultBus();
})();

export { FaultType, faultBus };