/**
 * The normalizer creates a more easy to handle process model out of valid BPMN model. This includes:
 * 1. Normalize starts when there are multiple ones.
 * 2. Normalize ends when there are multiple ones.
 * 3. Normalize starts and ends if they got incoming or outgoing flows, respectively, during normalization.
 * 4. Normalize gateways when they have multiple incoming and multiple outgoing flows.
 * 5. Normalize tasks when they have multiple incoming or multiple outgoing flows.
 * 6. Add tasks between directly connected gateways.
 */
let Normalizer = (function () {

    function NormalizerFactory() {
        let elementId = 1;
        this.withFaults = true;
        let that = this;

        this.normalize = function (bpmn, withFaults = true) {
            that.withFaults = withFaults;
            if (!Array.isArray(bpmn)) bpmn = [bpmn];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    bpmn.getProcesses.forEach(this.normalizeProcess);
                }
            });
            return bpmn;
        };
        this.normalizeProcess = function (process, withFaults = that.withFaults) {
            that.withFaults = withFaults;
            if (process instanceof Process) {
                process.computeInOut();
                normalizeStarts(process);
                process.computeInOut();
                normalizeEnds(process);
                process.computeInOut();
                normalizeStartAndEnds(process);
                normalizeGateways(process);
                process.computeInOut();
                normalizeTasks(process);
                process.computeInOut();
                normalizeFlows(process);
                process.computeInOut();
            }
        };

        let normalizeStarts = function (process) {
            // Detect implicit start nodes
            console.log("checking for implicit starts");
            console.log("getting nodes: ", process.getNodes);
            let starts = asList(process.getNodes).filter((n) => asList(n.getIncoming).length === 0);
            console.log("the starts found: ", starts);

            if (starts.length === 0 && that.withFaults) {
                faultBus.addError(process, [], FaultType.NO_START);
                return;
            }

            let implicitStarts = starts.filter((n) => !(n instanceof Start));
            if (that.withFaults) {
                implicitStarts.forEach((n) => faultBus.addInfo(process, [n], FaultType.IMPLICIT_START));
            }
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
                        sf.setUI(start.getUI);
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
            if (!(and instanceof Start) || asList(and.getOutgoing).length >= 2) {
                let start = new Start('n' + elementId++, 'StartEvent');
                start.setUI(and.getUI);
                process.addNode(start);
                process.addEdge(new Edge('n' + elementId++, start, and));
            }

            // Replace each explicit start with multiple outgoing flows with an AND gateway.
            explicitStarts.forEach(function (start) {
                if (asList(start.getOutgoing).length >= 2) {
                    let nStart = new Gateway(start.getId, null, GatewayType.AND);
                    nStart.setUI(start.getUI);
                    process.replaceNode(start, nStart, false);
                }
            });
        };

        let normalizeEnds = function (process) {
            // Detect implicit end nodes
            let ends =
                asList(process.getNodes).filter((n) => asList(n.getOutgoing).length === 0);

            if (ends.length === 0 && that.withFaults) {
                console.log("No end found");
                faultBus.addError(process, [], FaultType.NO_END);
                return;
            }

            let implicitEnds = ends.filter((n) => !(n instanceof End));
            if (that.withFaults) {
                implicitEnds.forEach((n) => faultBus.addInfo(process, [n], FaultType.IMPLICIT_END));
            }

            // By the BPMN spec, p. 248, a process is in a running state until all tokens are consumed.
            // If an end event has multiple incoming flows, then they can be inclusive.
            // For this reason, we can insert an OR-join to combine all end events.

            let or = null;
            if (ends.length >= 2) {
                or = new Gateway('n' + elementId++, null, (that.withFaults ? GatewayType.OR : GatewayType.XOR));
                or.setUI(ends.map((e) => e.getUI));
                process.addNode(or);
                ends.forEach(function (end) {
                    if (end instanceof End && asList(end.getIncoming).length >= 2) {
                        // If an end event has multiple incoming flows, make the joining behavior explicit.
                        let nEnd = new Gateway(end.getId, null, GatewayType.OR);
                        nEnd.setUI(end.getUI);
                        process.replaceNode(end, nEnd, false);
                        end = nEnd;
                    }
                    let sf = new Edge('n' + elementId++, end, or);
                    process.addEdge(sf);
                });
            }
            if (or === null) {
                let end = ends[0];
                // If the single end event has multiple incoming flows, make its joining behavior explicit.
                if (end instanceof End && asList(end.getIncoming).length >= 2) {
                    let nEnd = new Gateway(end.getId, null, GatewayType.OR);
                    nEnd.setUI(end.getUI);
                    process.replaceNode(end, nEnd, false);
                    or = nEnd;
                }
            }

            if (or !== null) {
                let end = new End('n' + elementId++, 'EndEvent');
                end.setUI(or.getUI);
                process.addNode(end);
                process.addEdge(new Edge('n' + elementId++, or, end));
            }
        };

        let normalizeStartAndEnds = function (process) {
            let startEnds = asList(process.getNodes).filter((n) => (n instanceof Start || n instanceof End));
            startEnds.forEach(function (s) {
                if ((s instanceof Start && asList(s.getIncoming).length >= 1) ||
                    (s instanceof End && asList(s.getOutgoing).length >= 1)) {
                    let nS = new Task(s.getId, s.className);
                    nS.setUI(s.getUI);
                    process.replaceNode(s, nS, false);
                    nS.setIncoming(s.getIncoming);
                    nS.setOutgoing(s.getOutgoing);
                }
            });
        }

        let normalizeGateways = function (process) {
            let gateways = asList(process.getNodes).filter((n) => (n instanceof Gateway));
            gateways.forEach(function (g) {
                if (asList(g.getOutgoing).length >= 2 && asList(g.getIncoming).length >= 2) {
                    // Split the gateway into two.
                    let n = new Gateway('n' + elementId++, null, g.getKind);
                    n.setUI(g.getUI);
                    process.addNode(n);
                    asList(g.getOutgoing).forEach(function (e) {
                        e.setSource(n);
                    });
                    process.addEdge(new Edge('n' + elementId++, g, n));
                }/* else if (asList(g.getOutgoing).length === 1 && asList(g.getIncoming).length === 1) {
                    // Replace it with a task
                    if (that.withFaults) faultBus.addWarning(process, g, FaultType.GATEWAY_WITHOUT_MULTIPLE_FLOWS);
                    let t = new Task(g.getId, g.getType);
                    t.setUI(g.getUI);
                    process.replaceNode(g, t);
                }*/
            });
        };

        let normalizeTasks = function (process) {
            let tasks = asList(process.getNodes).filter((n) => (n instanceof Task));
            tasks.forEach(function (t) {
                // Following p. 151 of the BPMN spec, an activity with multiple incoming flows
                // will always be instantiated when a token is on an incoming flow. I.e., if there
                // are two incoming flows with a token of each of them, the activity is executed twice.
                // We model that with an XOR gateway.
                if (asList(t.getIncoming).length >= 2) {
                    let g = new Gateway('n' + elementId++, null, GatewayType.XOR);
                    g.setUI(t.getUI);
                    process.addNode(g);
                    asList(t.getIncoming).forEach(function (e) {
                        e.setTarget(g);
                    });
                    process.addEdge(new Edge('n' + elementId++, g, t));
                }
                // Following p. 151 of the BPMN spec, an activity with multiple outgoing flows
                // will place a token on all its outgoing flows. We model this explicitly with an
                // AND gateway.
                if (asList(t.getOutgoing).length >= 2) {
                    // Split the gateway into two.
                    let g = new Gateway('n' + elementId++, null, GatewayType.AND);
                    g.setUI(t.getUI);
                    process.addNode(g);
                    asList(t.getOutgoing).forEach(function (e) {
                        e.setSource(g);
                    });
                    process.addEdge(new Edge('n' + elementId++, t, g));
                }
            });
        };

        let normalizeFlows = function (process) {
            let gateways = asList(process.getNodes).filter(n => n instanceof Gateway);
            gateways.forEach(function (g) {
                asList(g.getOutgoing).forEach(e => {
                    let s = e.getTarget;
                    if (s instanceof Gateway) {
                        // We add a task in between them to simplify analysis.
                        let t = new VirtualTask('n' + elementId++);
                        t.setUI(e.getUI);
                        process.addNode(t);
                        e.setTarget(t);
                        process.addEdge(new Edge('n' + elementId++, t, s));
                    }
                });
            });
        };
    }

    return new NormalizerFactory();
})();