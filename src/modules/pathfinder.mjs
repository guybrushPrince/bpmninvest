import {asList, asObject, diff, intersect, union} from "./settools.mjs";
import {blowUpWithEdges, LoopEntryGateway, LoopExitGateway, LoopProcess, LoopTask, Start} from "./model.mjs";
import {flatten} from "array-flatten";

let PathFinderFactory = function(modeler = null) {

    function PathFinder() {

        let elementRegistry = (modeler !== null) ? modeler.get('elementRegistry') : null;

        this.findPathFromStartToTarget = function(target, process,
                                                  scope = null,
                                                  exclude = {}, starts = null) {
            // We have an acyclic workflow-graph-like process model with a single start node having a path to target.
            // Thus, we can just go from the target to the start node.
            if (starts === null) starts = process.getStarts;

            // At first, determine the nodes being allowed to visit.
            let allowed = union(process.getNodes, process.getEdges);
            if (scope !== null) {
                scope = blowUpWithEdges(scope);
                allowed = intersect(allowed, scope);
            }
            exclude = blowUpWithEdges(exclude);
            allowed = diff(allowed, exclude);

            // Since there could be nodes and edges being not allowed to travel on, we
            // perform the algorithm in two steps:
            // 1. Backward analysis to get all nodes with a path to target.
            // 2. Forward analysis from the start to determine a single path.
            let list = [target];
            let pathArea = {};
            pathArea[target.getId] = target;
            do {
                let cur = list.shift();
                let next = diff(intersect(allowed, cur.getPreset), pathArea);
                pathArea = union(pathArea, next);
                list = asList(union(asObject(list), next));
            } while (list.length > 0);

            console.log(pathArea, allowed, scope, exclude);

            if (asList(intersect(pathArea, asObject(starts))).length === 0) return null;

            // Now, we walk from the start node to the target knowing that each node in pathArea being reachable from
            // the start node finally leads to target.
            let path = [];
            let pathSet = {};
            let cur = asList(intersect(asObject(starts), pathArea)).shift();
            do {
                path.push(cur);
                pathSet[cur.getId] = cur;
                cur = asList(diff(intersect(cur.getPostset, pathArea), pathSet)).shift();
            } while (cur !== undefined && cur.getId !== target.getId);
            path.push(cur);

            console.log(path);

            // It may happen that we are in a sub process after loop decomposition. Therefore, we have to extend the path
            // with a path in the super process.
            if (process.getSuper !== null) {
                // Identify the corresponding loop node
                let supProcess = process.getSuper;
                let targetNodes = asList(supProcess.getNodes).filter(n => (n instanceof LoopTask && n.getLoop.getId === process.getId));

                let superPath = this.findPathFromStartToTarget(targetNodes.shift(), supProcess);
                superPath.pop(); // Remove the loop node
                path.forEach(p => superPath.push(p));
                path = superPath;
            }

            return path;
        }

        this.modelPathToBPMNPath = function (path) {
            let bpmnPath = path.reduce((b,c,i) => {
                let n = null;
                if (i + 1 < path.length) n = path[i + 1];
                if (c !== undefined && c !== null) b.push(asList(c.elementIds));
                if (n !== null && n !== undefined) {
                    let flow = asList(c.getOutgoing).filter(e => e.getTarget.getId === n.getId);
                    if (flow.length > 0) {
                        flow = flow.shift();
                        b.push(asList(flow.elementIds));
                    }
                }
                return b;
            }, []);
            bpmnPath = flatten(bpmnPath);
            return [...new Set(bpmnPath)];
        };

        this.mapNodeSetToBPMN = function (set) {
            if (elementRegistry === null) return [];
            console.log('Map ', set, ' to BPMN');
            let loopTasks = {};
            let loopEntryGateways = {};
            let loopExitGateways = {};
            let ordinary = {};
            asList(set).forEach(n => {
                if (n instanceof LoopTask) loopTasks[n.getId] = n;
                else if (n instanceof LoopEntryGateway) loopEntryGateways[n.getId] = n;
                else if (n instanceof LoopExitGateway) loopExitGateways[n.getId] = n;
                else ordinary[n.getId] = n;
            });
            // Collect the ordinaries.
            let bpmn = flatten(asList(ordinary).reduce((bpmn, o) => {
                if (o.elementIds !== undefined && o.elementIds !== null) {
                    bpmn.push(asList(o.elementIds));
                }
                return bpmn;
            }, []));
            // Collect the exit gateways. It may happen that this gateway represents multiple loop exits.
            // Not each outgoing flow and gateway must be represented by those loop exit gateways.
            let bpmnExits = asList(loopExitGateways).reduce((bp, g) => {
                asList(g.getExits).forEach(exit => {
                    if (exit.elementIds !== undefined && exit.elementIds !== null) {
                        console.log(exit, 'with', exit.elementIds);
                        asList(exit.elementIds).forEach(ex => {
                            let exBPMN = elementRegistry.get(ex);
                            console.log(exit, 'with', exit.elementIds, 'check', exBPMN);
                            if (exBPMN !== undefined && 'outgoing' in exBPMN) {
                                let isWithin = exBPMN.outgoing.filter(o => {
                                    console.log(o, o.target, o.target.id, asList(bpmn));
                                    return bpmn.includes(o.target.id) || bpmn.includes(o.id);
                                });
                                console.log('Has Within', isWithin);
                                if (isWithin.length > 0) bp.push(ex);
                            }
                        });
                    }
                });
                return bp;
            }, []);
            // Collect the entry gateways. It may happen that this gateway represents multiple loop entries.
            // Not each incoming flow and gateway must be represented by those loop entry gateways.
            let bpmnEntries = asList(loopEntryGateways).reduce((bp, g) => {
                asList(g.getEntries).forEach(entry => {
                    if (entry.elementIds !== undefined && entry.elementIds !== null) {
                        asList(entry.elementIds).forEach(en => {
                            let enBPMN = elementRegistry.get(en);
                            if (enBPMN !== undefined && 'incoming' in enBPMN) {
                                let isWithin = enBPMN.incoming.filter(o =>
                                    bpmn.includes(o.source.id) || bpmn.includes(o.id));
                                if (isWithin.length > 0) bp.push(en);
                            }
                        });
                    }
                });
                return bp;
            }, []);
            // Collect the loop tasks.
            let bpmnElementsLoops = asList(loopTasks).map(t => {
                return this.mapNodeSetToBPMN(t.getLoop.getNodes);
            });
            bpmnElementsLoops = flatten(bpmnElementsLoops);
            bpmnElementsLoops = [...new Set(bpmnElementsLoops)];

            // Make it unique.
            bpmn.push(bpmnExits);
            bpmn.push(bpmnEntries);
            bpmn = flatten(bpmn);
            bpmn = [...new Set(bpmn)];
            // Map to elements
            let bpmnElements = flatten(bpmn.map(elId => {
                if (typeof elId !== 'string') return [];
                console.log('Try to find', elId);
                let element = elementRegistry.get(elId);
                if (element !== undefined) {
                    if ('outgoing' in element && 'incoming' in element) {
                        console.log('Check', element.id, element.outgoing, element.incoming, bpmn);
                        let flowsOut = element.outgoing.filter(flow => bpmn.includes(flow.target.id));
                        let flowsIn = element.incoming.filter(flow => bpmn.includes(flow.source.id));
                        let flows = flowsOut.concat(flowsIn);
                        flows.push(element);
                        console.log(flows);
                        return flows;
                    } else return [ element ];
                }
                return [];
            }));
            console.log('Häh', bpmnElements, bpmnElements.concat(bpmnElementsLoops), new Set(bpmnElements.concat(bpmnElementsLoops)));
            bpmnElements = [...new Set(bpmnElements.concat(bpmnElementsLoops))];
            console.log('Mapped ', set, ' to ', bpmnElements);
            return bpmnElements;
        }
    }

    return new PathFinder();
};

export { PathFinderFactory };