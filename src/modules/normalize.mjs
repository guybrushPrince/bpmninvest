"use strict";
/**
 * The normalizer creates a more easy to handle process model out of valid BPMN model. This includes:
 * 1. Normalize starts when there are multiple ones.
 * 2. Normalize ends when there are multiple ones.
 * 3. Normalize starts and ends if they got incoming or outgoing flows, respectively, during normalization.
 * 4. Normalize gateways when they have multiple incoming and multiple outgoing flows.
 * 5. Normalize tasks when they have multiple incoming or multiple outgoing flows.
 * 6. Add tasks between directly connected gateways.
 */
import { FaultType, faultBus  } from "./faultbus.mjs";
import { BPMNModel, Process, Start, End, Gateway, GatewayType, Edge, Task, VirtualTask } from "./model.mjs";
import {asList, union} from "./settools.mjs";
import {flatten} from "array-flatten";
import {PathFinderFactory} from "./pathfinder.mjs";

/**
 * Normalizes a process model out of a BPMN model.
 * @type {NormalizerFactory}
 */
const Normalizer = (function () {

    function NormalizerFactory() {
        let elementId = 1;

        this.normalize = function (bpmn, withFaults = true) {
            console.log('Normalize', bpmn);
            if (!Array.isArray(bpmn)) bpmn = [bpmn];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    bpmn.getProcesses.forEach((p) => this.normalizeProcess(p, withFaults));
                }
            });
            return bpmn;
        };
        this.normalizeProcess = function (process, withFaults = true) {
            if (process instanceof Process) {
                normalizeSingletonProcess(process);
                process.computeInOut();
                normalizeStarts(process, withFaults);
                process.isValid();
                process.computeInOut();
                normalizeEnds(process, withFaults);
                process.isValid();
                process.computeInOut();
                normalizeStartAndEnds(process);
                process.isValid();
                normalizeGateways(process, withFaults);
                process.isValid();
                process.computeInOut();
                normalizeTasks(process);
                process.isValid();
                process.computeInOut();
                normalizeFlows(process);
                process.isValid();
                process.computeInOut();
            }
        };

        let normalizeSingletonProcess = function (process) {
            // If there is a process model with just a single node ...
            if (process.getNodes.length === 1) {
                // ... add one to have a process with start and end.
                let newNode;
                let newEdge;
                let single = asList(process.getNodes)[0];
                if (single instanceof End) {
                    newNode = new Start('n' + elementId++, 'StartEvent');
                    newEdge = new Edge('n' + elementId++, newNode, single);
                } else {
                    newNode = new End('n' + elementId++, 'EndEvent');
                    newEdge = new Edge('n' + elementId++, single, newNode);
                }
                newNode.setUI(single.getUI);
                newNode.addElementId(single.elementIds);
                process.addNode(newNode);
                newEdge.setUI(single.getUI);
                newEdge.addElementId(single.elementIds);
                process.addEdge(newEdge);
            }
        }

        let normalizeStarts = function (process, withFaults = true) {
            // Detect implicit start nodes
            let starts = asList(process.getNodes).filter((n) => asList(n.getIncoming).length === 0);

            if (starts.length === 0 && withFaults) {
                faultBus.addError(process, [], FaultType.NO_START);
                return;
            }

            let explicitStarts = starts.filter((n) => (n instanceof Start));
            let implicitStarts = starts.filter((n) => !(n instanceof Start));
            if (withFaults) {
                implicitStarts.forEach((n) => faultBus.addInfo(process, {
                    implicitStart: [ n ],
                    simulation: {
                        starts: explicitStarts
                    }
                }, FaultType.IMPLICIT_START));
            }

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
                    xor.addElementId(flatten(explicitStarts.map((s) => s.elementIds)));
                    process.addNode(xor);
                    explicitStarts.forEach(function (start) {
                        let sf = new Edge('n' + elementId++, xor, start);
                        sf.setUI(start.getUI);
                        sf.addElementId(start.elementIds);
                        process.addEdge(sf);
                    });
                }
            }
            let and = xor;
            if (implicitStarts.length > 0) {
                if (xor !== null || implicitStarts.length >= 2) {
                    and = new Gateway('n' + elementId++, null, GatewayType.AND);
                    and.setUI(implicitStarts.map((s) => s.getUI));
                    and.addElementId(flatten(implicitStarts.map((s) => s.elementIds)));
                    process.addNode(and);
                    implicitStarts.forEach(function (start) {
                        process.addEdge(new Edge('n' + elementId++, and, start));
                    });
                    if (xor !== null) {
                        and.getUI.push(xor.getUI);
                        and.getUI.flat();
                        and.addElementId(xor.elementIds);
                        process.addEdge(new Edge('n' + elementId++, and, xor));
                    }
                } else {
                    and = implicitStarts[0];
                }
            }
            if (!(and instanceof Start) || asList(and.getOutgoing).length >= 2) {
                let start = new Start('n' + elementId++, 'StartEvent');
                start.setUI(and.getUI);
                start.addElementId(and.elementIds);
                process.addNode(start);
                process.addEdge(new Edge('n' + elementId++, start, and));
            }

            // Replace each explicit start with multiple outgoing flows with an AND gateway.
            explicitStarts.forEach(function (start) {
                if (asList(start.getOutgoing).length >= 2) {
                    let nStart = new Gateway(start.getId, null, GatewayType.AND);
                    nStart.setUI(start.getUI);
                    nStart.addElementId(start.elementIds);
                    process.replaceNode(start, nStart, false);
                }
            });
        };

        let normalizeEnds = function (process, withFaults = true) {
            // Detect implicit end nodes
            let ends =
                asList(process.getNodes).filter((n) => asList(n.getOutgoing).length === 0);

            if (ends.length === 0 && withFaults) {
                faultBus.addError(process, [], FaultType.NO_END);
                return;
            }

            let implicitEnds = ends.filter((n) => !(n instanceof End));
            if (withFaults) {
                implicitEnds.forEach((n) => faultBus.addInfo(process, {
                    implicitEnd: [ n ],
                    simulation: {
                        path: PathFinderFactory().findPathFromStartToTarget(n, process)
                    }
                }, FaultType.IMPLICIT_END));
            }

            // By the BPMN spec, p. 248, a process is in a running state until all tokens are consumed.
            // If an end event has multiple incoming flows, then they can be inclusive.
            // For this reason, we can insert an OR-join to combine all end events.

            let or = null;
            if (ends.length >= 2) {
                or = new Gateway('n' + elementId++, null, (withFaults ? GatewayType.OR : GatewayType.XOR));
                or.setUI(ends.map((e) => e.getUI));
                or.addElementId(flatten(ends.map((e) => e.elementIds)));
                if (!withFaults) or.setDivergingEnd(true);
                process.addNode(or);
                ends.forEach(function (end) {
                    if (end instanceof End && asList(end.getIncoming).length >= 2) {
                        // If an end event has multiple incoming flows, make the joining behavior explicit.
                        let nEnd = new Gateway(end.getId, null, GatewayType.OR);
                        nEnd.setUI(end.getUI);
                        nEnd.addElementId(end.elementIds);
                        process.replaceNode(end, nEnd, false);
                        end = nEnd;
                    }
                    let sf = new Edge('n' + elementId++, end, or);
                    sf.addElementId(union(end.elementIds, or.elementIds));
                    process.addEdge(sf);
                });
            }
            if (or === null) {
                let end = ends[0];
                // If the single end event has multiple incoming flows, make its joining behavior explicit.
                if (end instanceof End && asList(end.getIncoming).length >= 2) {
                    let nEnd = new Gateway(end.getId, null, GatewayType.OR);
                    nEnd.setUI(end.getUI);
                    nEnd.addElementId(end.elementIds);
                    process.replaceNode(end, nEnd, false);
                    or = nEnd;
                }
            }

            if (or !== null) {
                let end = new End('n' + elementId++, 'EndEvent');
                end.setUI(or.getUI);
                end.addElementId(or.elementIds);
                process.addNode(end);
                process.addEdge(new Edge('n' + elementId++, or, end));
            } else if (ends.length === 1 && implicitEnds.length === 1) {
                let end = new End('n' + elementId++, 'EndEvent');
                end.setUI(ends[0].getUI);
                end.addElementId(ends[0].elementIds);
                process.addNode(end);
                process.addEdge(new Edge('n' + elementId++, ends[0], end));
            }
        };

        let normalizeStartAndEnds = function (process) {
            let startEnds = asList(process.getNodes).filter((n) => (n instanceof Start || n instanceof End));
            startEnds.forEach(function (s) {
                if ((s instanceof Start && asList(s.getIncoming).length >= 1) ||
                    (s instanceof End && asList(s.getOutgoing).length >= 1)) {
                    let nS = new Task(s.getId, s.className);
                    nS.setUI(s.getUI);
                    nS.addElementId(s.elementIds);
                    process.replaceNode(s, nS, false);
                    nS.setIncoming(s.getIncoming);
                    nS.setOutgoing(s.getOutgoing);
                }
            });
        }

        let normalizeGateways = function (process, withFaults = true) {
            let gateways = asList(process.getNodes).filter((n) => (n instanceof Gateway));
            gateways.forEach(function (g) {
                if (asList(g.getOutgoing).length >= 2 && asList(g.getIncoming).length >= 2) {
                    // Split the gateway into two.
                    let n = new Gateway('n' + elementId++, null, g.getKind);
                    n.setUI(g.getUI);
                    n.addElementId(g.elementIds);
                    process.addNode(n);
                    asList(g.getOutgoing).forEach(function (e) {
                        e.setSource(n);
                    });
                    process.addEdge(new Edge('n' + elementId++, g, n));
                } else if (asList(g.getOutgoing).length === 1 && asList(g.getIncoming).length === 1) {
                    if (withFaults) faultBus.addWarning(process, g, FaultType.GATEWAY_WITHOUT_MULTIPLE_FLOWS);
                    /*
                    // Replace it with a task
                    let t = new Task(g.getId, g.getType);
                    t.setUI(g.getUI);
                    process.replaceNode(g, t);*/
                }
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
                    g.addElementId(t.elementIds);
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
                    g.addElementId(t.elementIds);
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
                        t.addElementId(e.elementIds);
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

export { Normalizer };