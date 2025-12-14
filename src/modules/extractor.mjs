import { BPMNModel, Edge, End, EventType, Gateway, MessageFlow, Process, Start, Task, ProcessEvent } from "./model.mjs";
import { flatten } from "array-flatten";
import { getBusinessObject } from "bpmn-js/lib/util/ModelUtil";
import { asList } from "./settools.mjs";

const ModelExtractor = (function () {

    function ModelExtractorFactory() {
        let nodes = {};
        let edges = {};

        this.extractDiagram = function(modeler) {
            let elements = modeler.get('elementRegistry').getAll();
            let collaborations = findCollaborations(elements);
            if (collaborations.length === 0) {
                collaborations = findProcessLike(elements);
            } else {
                collaborations = collaborations.concat(findSubProcesses(elements));
            }
            let processes = identifyProcesses(collaborations);
            let iProcesses = createInternProcesses(processes);

            asList(nodes).forEach(n => {
                if (n instanceof Task && typeof n.getSubProcess === 'function') {
                    n.getSubProcess(iProcesses);
                }
            })

            let model = new BPMNModel(processes.map(p => p.id).join("-"));
            model.setProcesses(iProcesses);
            return model;
        }

        let findCollaborations = function (elements) {
            return elements.filter(el => isOfType(el,'Collaboration'));
        };

        let findProcessLike = function (elements) {
            return elements.filter(el => (isOfType(el, 'Process') && !el.collapsed) ||
                isOfType(el, 'Participant') || (isOfType(el, 'SubProcess') && !el.collapsed));
        };
        let findSubProcesses = function (elements) {
            return elements.filter(el => (isOfType(el, 'SubProcess') && !el.collapsed));
        };

        let identifyProcesses = function (collaborations) {
            return flatten(collaborations.map(col => {
                if (isOfType(col,'Collaboration')) {
                    return col.children.filter(el => isOfType(el, 'Process') ||
                        isOfType(el, 'Participant') ||
                        (isOfType(el, 'SubProcess') && !el.collapsed));
                } else {
                    return col;
                }
            }));
        };

        let createInternProcesses = function (processes) {
            let subProcesses = processes.filter(p => isOfType(p, 'SubProcess'));
            let nonSubProcesses = processes.filter(p => !isOfType(p, 'SubProcess'));
            processes = subProcesses.concat(nonSubProcesses);

            return processes.map(p => {
                let process = new Process(p.id);
                process.addElementId(p.id);
                let nfs = extractNodesAndFlows(p, process);
                process.setNodes(nfs.reduce((n,nf) => {
                    if (!(nf instanceof Edge)) n[nf.getId] = nf;
                    return n;
                }, {}));
                process.setEdges(nfs.reduce((e,nf) => {
                    if (nf instanceof Edge) e[nf.getId] = nf;
                    return e;
                }, {}));
                process.computeInOut();

                return process;
            })
        };

        let extractNodesAndFlows = function (process, processModel) {
            let nodesAndFlows = process.children.map(el => {
                if (isOfType(el, 'Flow')) {
                    return getOrCreateEdge(el, processModel);
                } else {
                    return getOrCreateDetailedNode(el, processModel);
                }
            });
            nodesAndFlows = nodesAndFlows.filter(nf => nf !== null);
            return nodesAndFlows;
        };

        let getOrCreateNode = function (node, process) {
            let id = node.id;
            let type = node.type;
            if (!(id in nodes)) {
                if (isOfType(node, 'Task') || isOfType(node, 'Intermediate') ||
                    isOfType(node, 'SubProcess')) {
                    nodes[id] = new Task(id, type);
                    if (isOfType(node, 'SubProcess') && !node.collapsed) {
                        nodes[id].setSubProcess(function (processes) {
                            for (let p of processes) {
                                if (p.getId === id) {
                                    nodes[id].setSubProcess(p);
                                    p.setSuper(process);
                                    return;
                                }
                            }
                        });
                    }
                } else if (isOfType(node, 'Start')) nodes[id] = new Start(id, type);
                else if (isOfType(node, 'End')) nodes[id] = new End(id, type);
                else if (isOfType(node, 'Gateway')) nodes[id] = new Gateway(id, type);
                else if (isOfType(node, 'label') || isOfType(node, 'Association')) return null;
                else if (isOfType(node, 'BoundaryEvent')) {
                    nodes[id] = new ProcessEvent(id, type);
                    let bO = getBusinessObject(node);
                    if ('attachedToRef' in bO) {
                        let attached = getOrCreateNode(bO.attachedToRef, process);
                        if (attached) {
                            attached.addBoundary(nodes[id]);
                        }
                    }
                    if ('cancelActivity' in bO) {
                        nodes[id].setInterrupting(bO.cancelActivity);
                    }
                } else {
                    console.log([id, type, node]);
                    return null;
                }
            }
            nodes[id].addElementId(id);
            return nodes[id];
        };

        let getOrCreateDetailedNode = function (node, process) {
            let n = getOrCreateNode(node, process);
            return n;
        };

        let getOrCreateEdge = function (flow, process) {
            let id = flow.id;
            if (!(id in edges)) {
                edges[id] = new Edge(id,
                    getOrCreateNode(flow.source, process),
                    getOrCreateNode(flow.target, process)
                );
            }
            edges[id].addElementId(id);
            return edges[id];
        };

        let isOfType = function (element, type) {
            let givenType = element.type;
            if (givenType.includes(type)) {
                return !givenType.includes('label'); // Ignore labels.
            }
            return false;
        };

    }
    return new ModelExtractorFactory();
});
export default ModelExtractor;