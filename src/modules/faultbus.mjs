const FaultLevel = {
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
            console.log(FaultLevel.INFO, [process, elements, fault]);
            this.notify(FaultLevel.INFO, process, elements, fault);
        };

        this.addWarning = function (process, elements, fault) {
            console.log(FaultLevel.WARNING, [process, elements, fault]);
            this.notify(FaultLevel.WARNING, process, elements, fault);
        };

        this.addError = function (process, elements, fault) {
            console.log(FaultLevel.ERROR, [process, elements, fault]);
            this.notify(FaultLevel.ERROR, process, elements, fault);
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

export { FaultLevel, faultBus };