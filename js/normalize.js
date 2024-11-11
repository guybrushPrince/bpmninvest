/**
 * This function gets a BPMN model as input and normalizes the graphs, i.e., it:
 * 1. Inserts
 */
let Normalizer = function () {
    function NormalizerFactory() {
        let elementId = 1;

        this.normalize = function (bpmn) {
            if (!Array.isArray(bpmn)) bpmn = [bpmn];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    bpmn.getProcesses.forEach(normalizeProcess);
                }
            });
            return bpmn;
        };
        let normalizeProcess = function (process) {
            if (process instanceof Process) {
                process.computeInOut();
                normalizeStarts(process);
                process.computeInOut();
                normalizeEnds(process);
                process.computeInOut();
                normalizeGateways(process);
                process.computeInOut();
            }
        };

        let normalizeStarts = function (process) {
            // Detect implicit start nodes
            let starts =
                Object.values(process.getNodes).filter((n) => Object.values(n.getIncoming).length === 0);

            if (starts.length === 0) {
                faultBus.addError(process, [], FaultType.NO_START);
                return;
            }

            let implicitStarts = starts.filter((n) => !(n instanceof Start));
            implicitStarts.forEach((n) => faultBus.addInfo(process, [n], FaultType.IMPLICIT_START));
            let explicitStarts = starts.filter((n) => (n instanceof Start));

            // By the BPMN spec, start events are mutually explicit.
            // Implicit starts, however, get always parallel to a start events a token.
            // Therefore, we combine the explicit with a single XOR.
            // Then, we combine the implicit + the XOR with a single AND.

            let xor = null;
            if (explicitStarts.length > 0) {
                xor = explicitStarts[0];
                if (explicitStarts.length >= 2) {
                    xor = new Gateway('n' + elementId++, null, GatewayType.XOR);
                    xor.setUI(explicitStarts.map((s) => s.getUI));
                    process.addNode(xor);
                    explicitStarts.forEach(function (start) {
                        let sf = new Edge('n' + elementId++, xor, start);
                        process.addEdge(sf);
                    });
                }
            }
            let and = xor;
            if (implicitStarts.length > 0) {
                if (xor !== null || implicitStarts.length >= 2) {
                    and = new Gateway('n' + elementId++, null, GatewayType.AND);
                    and.setUI(implicitStarts.map((s) => s.getUI));
                    process.addNode(and);
                    implicitStarts.forEach(function (start) {
                        process.addEdge(new Edge('n' + elementId++, and, start));
                    });
                    if (xor !== null) {
                        and.getUI.push(xor.getUI);
                        and.getUI.flat();
                        process.addEdge(new Edge('n' + elementId++, and, xor));
                    }
                } else {
                    and = implicitStarts[0];
                }
            }
            if (!(and instanceof Start) || Object.values(and.getOutgoing).length >= 2) {
                let start = new Start('n' + elementId++, 'StartEvent');
                start.setUI(and.getUI);
                process.addNode(start);
                process.addEdge(new Edge('n' + elementId++, start, and));
            }

            // Replace each explicit start with multiple outgoing flows with an AND gateway.
            explicitStarts.forEach(function (start) {
                if (Object.values(start.getOutgoing).length >= 2) {
                    let nStart = new Gateway(start.getId, null, GatewayType.AND);
                    nStart.setUI(start.getUI);
                    process.replaceNode(start, nStart);
                }
            });
        };

        let normalizeEnds = function (process) {
            // Detect implicit end nodes
            let ends =
                Object.values(process.getNodes).filter((n) => Object.values(n.getOutgoing).length === 0);

            if (ends.length === 0) {
                faultBus.addError(process, [], FaultType.NO_END);
                return;
            }

            let implicitEnds = ends.filter((n) => !(n instanceof End));
            implicitEnds.forEach((n) => faultBus.addInfo(process, [n], FaultType.IMPLICIT_END));

            // By the BPMN spec, p. 248, a process is in a running state until all tokens are consumed.
            // If an end event has multiple incoming flows, then they can be inclusive.
            // For this reason, we can insert an OR-join to combine all end events.

            let or = null;
            if (ends.length >= 2) {
                or = new Gateway('n' + elementId++, null, GatewayType.OR);
                or.setUI(ends.map((e) => e.getUI));
                process.addNode(or);
                ends.forEach(function (end) {
                    if (end instanceof End && Object.values(end.getIncoming).length >= 2) {
                        // If an end event has multiple incoming flows, make the joining behavior explicit.
                        let nEnd = new Gateway(end.getId, null, GatewayType.OR);
                        nEnd.setUI(end.getUI);
                        process.replaceNode(end, nEnd);
                        end = nEnd;
                    }
                    let sf = new Edge('n' + elementId++, end, or);
                    process.addEdge(sf);
                });
            }
            if (or === null) {
                let end = ends[0];
                // If the single end event has multiple incoming flows, make its joining behavior explicit.
                if (end instanceof End && Object.values(end.getIncoming).length >= 2) {
                    let nEnd = new Gateway(end.getId, null, GatewayType.OR);
                    nEnd.setUI(end.getUI);
                    process.replaceNode(end, nEnd);
                }
            }

            if (or !== null) {
                let end = new End('n' + elementId++, 'EndEvent');
                end.setUI(or.getUI);
                process.addNode(end);
                process.addEdge(new Edge('n' + elementId++, or, end));
            }
        };

        let normalizeGateways = function(process) {
            let gateways = Object.values(process.getNodes).filter((n) => (n instanceof Gateway));
            console.log(gateways);
            gateways.forEach(function (g) {
                if (Object.values(g.getOutgoing).length >= 2 && Object.values(g.getIncoming).length >= 2) {
                    console.log(g);
                    // Split the gateway into two.
                    let n = new Gateway('n' + elementId++, null, g.getKind);
                    process.addNode(n);
                    Object.values(g.getOutgoing).forEach(function (e) {
                        e.setSource(n);
                    });
                    process.addEdge(new Edge('n' + elementId++, g, n));
                }
            });
        };
    }

    return new NormalizerFactory();
};