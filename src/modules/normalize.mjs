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
import {BPMNModel, Process, Start, End, Gateway, GatewayType, Edge, Task, VirtualTask, LoopProcess} from "./model.mjs";
import {asList, diff, intersect, union} from "./settools.mjs";
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
            if (!Array.isArray(bpmn)) bpmn = [bpmn];
            bpmn.forEach((bpmn) => {
                if (bpmn instanceof BPMNModel) {
                    let all = bpmn.getProcesses.reduce((all, p) => {
                        p.computeInOut();
                        let connected = findConnectedComponents(p);
                        connected.forEach((p) => this.normalizeProcess(p, withFaults));
                        all = all.concat(connected);
                        return all;
                    }, []);
                    bpmn.setProcesses(all);
                }
            });
            return bpmn;
        };
        this.normalizeProcess = function (process, withFaults = true) {
            if (process instanceof Process) {
                if (!withFaults && asList(process.getNodes).length === 0) return;
                normalizeSingletonProcess(process);
                process.computeInOut();
                normalizeBoundaryEvents(process);
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

        let findConnectedComponents = function (process) {
            let components = [];
            let nodes = union({}, process.getNodes);
            if (asList(nodes).length === 0) return [ process ];
            while (asList(nodes).length > 0) {
                let first = asList(nodes).shift();
                let component = {};
                let next = {};
                next[first.getId] = first;
                do {
                    let cur = asList(next).shift();
                    delete next[cur.getId];
                    delete nodes[cur.getId];
                    component[cur.getId] = cur;
                    next = union(next, intersect(union(cur.getPreset, cur.getPostset), nodes));
                } while (asList(next).length > 0);
                if (components.length === 0 && asList(process.getNodes).length === asList(component).length) {
                    // Everything is fine (the graph is connected).
                    return [ process ];
                } else {
                    // Create a new process model
                    let p = new Process(process.getId + '_' + components.length);
                    p.setNodes(component);
                    p.setUI(process.getUI);
                    p.addElementId(process.elementIds);
                    p.setEdges(asList(process.getEdges).reduce((ed, e) => {
                        if (e.getSource.getId in component && e.getTarget.getId in component) {
                            ed[e.getId] = e;
                        }
                        return ed;
                    }, {}));
                    components.push(p);
                }
            }
            return components;
        }

        let normalizeSingletonProcess = function (process) {
            // If there is a process model with just a single node ...
            if (asList(process.getNodes).length === 1) {
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

        let normalizeBoundaryEvents = function (process) {
            // Boundary events on tasks / sub-processes are handled by transforming them into an explicit gateway.
            let withBoundaryEvents = asList(process.getNodes).filter(n =>
                n instanceof Task && asList(n.getBoundaries).length >= 1);
            withBoundaryEvents.forEach(n => {
                let boundaryEvents = n.getBoundaries;
                // It depends on whether there is a non-interrupting boundary event or not if we require an
                // exclusive or inclusive gateway to model its behavior.
                let nonInterrupting = asList(boundaryEvents).filter(b => !b.isInterrupting);
                let gatewayKind = GatewayType.XOR;
                if (nonInterrupting.length >= 1) {
                    // We require an inclusive gateway.
                    gatewayKind = GatewayType.OR;
                }
                let gateway = new Gateway('n' + elementId++, null, gatewayKind);
                gateway.setUI(asList(boundaryEvents).map(b => b.getUI));
                gateway.addElementId(asList(boundaryEvents).map(b => b.elementIds));
                process.addNode(gateway);

                // Following p. 151 of the BPMN spec, an activity with multiple outgoing flows
                // will place a token on all its outgoing flows. We model this explicitly with an
                // AND gateway.
                // For this reason, we have to normalize the task first.
                if (asList(n.getOutgoing).length >= 2) {
                    // Add a parallel gateway after the task.
                    let g = new Gateway('n' + elementId++, null, GatewayType.AND);
                    g.setUI(n.getUI);
                    g.addElementId(n.elementIds);
                    process.addNode(g);
                    asList(n.getOutgoing).forEach(function (e) {
                        e.setSource(g);
                    });
                    // Add an edge to the splitting gateway for parallel outgoing flows.
                    let edge = new Edge('n' + elementId++, gateway, g);
                    edge.setUI(n.getUI);
                    edge.addElementId(n.elementIds);
                    process.addEdge(edge);

                    // Now, this gateway is the "new" n.
                    n = g;
                } else {
                    // Redirect the edges to start from the new boundary gateway.
                    asList(n.getOutgoing).forEach(function (e) {
                        e.setSource(gateway);
                    });
                }
                // Add an edge to the new gateway for the boundary events.
                let edge = new Edge('n' + elementId++, n, gateway);
                edge.setUI(n.getUI);
                edge.addElementId(n.elementIds);
                process.addEdge(edge);
                // Add an edge from the new boundary gateway to the event(s).
                asList(boundaryEvents).forEach(b => {
                    let edge = new Edge('n' + elementId++, gateway, b);
                    edge.setUI(b.getUI);
                    edge.addElementId(b.elementIds);
                    process.addEdge(edge);
                });
            });
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
                    and.setDivergingStart(true);
                    and.addElementId(flatten(implicitStarts.map((s) => s.elementIds)));
                    process.addNode(and);
                    implicitStarts.forEach(function (start) {
                        let edge = new Edge('n' + elementId++, and, start);
                        edge.setUI(start.getUI);
                        edge.addElementId(start.elementIds);
                        process.addEdge(edge);
                    });
                    if (xor !== null) {
                        and.getUI.push(xor.getUI);
                        and.getUI.flat();
                        and.addElementId(xor.elementIds);
                        let edge = new Edge('n' + elementId++, and, xor);
                        edge.setUI(and.getUI);
                        edge.addElementId(and.elementIds);
                        process.addEdge(edge);
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
                let edge = new Edge('n' + elementId++, start, and);
                edge.setUI(start.getUI);
                edge.addElementId(start.elementIds);
                process.addEdge(edge);
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
                if (!withFaults && process instanceof LoopProcess) or.setConvergingEnd(true);
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
                    sf.setUI(end.getUI);
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
                let edge = new Edge('n' + elementId++, or, end);
                edge.setUI(end.getUI);
                edge.addElementId(end.elementIds);
                process.addEdge(edge);
            } else if (ends.length === 1 && implicitEnds.length === 1) {
                let end = new End('n' + elementId++, 'EndEvent');
                end.setUI(ends[0].getUI);
                end.addElementId(ends[0].elementIds);
                process.addNode(end);
                let edge = new Edge('n' + elementId++, ends[0], end);
                edge.setUI(end.getUI);
                edge.addElementId(end.elementIds);
                process.addEdge(edge);
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
                    let edge = new Edge('n' + elementId++, g, n);
                    edge.setUI(g.getUI);
                    edge.addElementId(g.elementIds);
                    process.addEdge(edge);
                } else if (asList(g.getOutgoing).length <= 1 && asList(g.getIncoming).length <= 1 ||
                    asList(g.getOutgoing).length >= 2 && asList(g.getIncoming).length >= 2) {
                    if (withFaults) faultBus.addWarning(process, {
                        gateway: g,
                        incoming: asList(g.getIncoming).length,
                        outgoing: asList(g.getOutgoing).length
                    }, FaultType.GATEWAY_WITHOUT_MULTIPLE_FLOWS);
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
                    let edge = new Edge('n' + elementId++, g, t);
                    edge.setUI(g.getUI);
                    edge.addElementId(g.elementIds);
                    process.addEdge(edge);
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
                    let edge = new Edge('n' + elementId++, t, g);
                    edge.setUI(t.getUI);
                    edge.addElementId(t.elementIds);
                    process.addEdge(edge);
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
                        let edge = new Edge('n' + elementId++, t, s);
                        edge.setUI(e.getUI);
                        edge.addElementId(e.elementIds);
                        process.addEdge(edge);
                    }
                });
            });
        };
    }

    return new NormalizerFactory();
})();

export { Normalizer };