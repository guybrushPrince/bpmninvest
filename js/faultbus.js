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
        this.observers = []; // Array to store observers

        // Notify observers about fault
        this.addInfo = function (process, elements, fault) {
            console.log("Info:", [process, elements, fault]);
            this.notify('info', process, elements, fault);
        };

        this.addWarning = function (process, elements, fault) {
            console.log("Warning:", [process, elements, fault]);
            this.notify('warning', process, elements, fault);
        };

        this.addError = function (process, elements, fault) {
            console.log("Error:", [process, elements, fault]);
            this.notify('error', process, elements, fault);
        };

        // Add an observer
        this.subscribe = function (func) {
            this.observers.push(func);
            console.log("new subscriber added");
        };

        // Remove an observer
        this.unsubscribe = function (func) {
            this.observers = this.observers.filter((observer) => observer !== func);
        };

        // Notify all observers
        this.notify = function (type, process, elements, fault) {
            this.observers.forEach(observer => {
                observer(type, process, elements, fault);
            });
        };
    }
    return new FaultBus();
})();