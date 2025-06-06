import { BPMNModel, Edge, End, EventType, Gateway, MessageFlow, Process, Start, Task } from "./model.mjs";
import { flatten } from "array-flatten";

const ModelExtractor = (function () {

    function ModelExtractorFactory() {
        let nodes = {};
        let edges = {};

        this.extractDiagram = function(modeler) {
            let elements = modeler.get('elementRegistry').getAll();
            let collaborations = findCollaborations(elements);
            if (collaborations.length === 0) {
                collaborations = findProcessLike(elements);
            }
            let processes = identifyProcesses(collaborations);
            let iProcesses = createInternProcesses(processes);

            let model = new BPMNModel(processes.map(p => p.id).join("-"));
            model.setProcesses(iProcesses);
            return model;
        }

        let findCollaborations = function (elements) {
            return elements.filter(el => isOfType(el,'Collaboration'));
        };

        let findProcessLike = function (elements) {
            return elements.filter(el => isOfType(el, 'Process') ||
                isOfType(el, 'Participant') || isOfType(el, 'SubProcess'));
        };

        let identifyProcesses = function (collaborations) {
            return flatten(collaborations.map(col => {
                if (isOfType(col,'Collaboration')) {
                    return col.children.filter(el => isOfType(el, 'Process') ||
                        isOfType(el, 'Participant') || isOfType(el, 'SubProcess'));
                } else {
                    return col;
                }
            }));
        };

        let createInternProcesses = function (processes) {
            return processes.map(p => {
                let process = new Process(p.id);
                process.addElementId(p.id);
                let nfs = extractNodesAndFlows(p);
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

        let extractNodesAndFlows = function (process) {
            let nodesAndFlows = process.children.map(el => {
                if (isOfType(el, 'Flow')) {
                    return getOrCreateEdge(el);
                } else {
                    return getOrCreateDetailedNode(el);
                }
            });
            nodesAndFlows = nodesAndFlows.filter(nf => nf !== null);
            return nodesAndFlows;
        };

        let getOrCreateNode = function (node) {
            let id = node.id;
            let type = node.type;
            if (!(id in nodes)) {
                if (isOfType(node, 'Task')) nodes[id] = new Task(id, type);
                else if (isOfType(node, 'Start')) nodes[id] = new Start(id, type);
                else if (isOfType(node, 'End')) nodes[id] = new End(id, type);
                else if (isOfType(node, 'Gateway')) nodes[id] = new Gateway(id, type);
                else {
                    console.log([id, type]);
                    return null;
                }
            }
            nodes[id].addElementId(id);
            return nodes[id];
        };

        let getOrCreateDetailedNode = function (node) {
            let n = getOrCreateNode(node);
            if (n instanceof Start) {
                console.log(node);
                /*if ('eventDefinitions' in node && Array.isArray(node.eventDefinitions)) {
                    for (let ev of node.eventDefinitions) {
                        if (ev.$type.includes('Timer')) n.setEvent(EventType.TIMER);
                        else if (ev.$type.includes('Conditional')) n.setEvent(EventType.CONDITIONAL);
                        else if (ev.$type.includes('Message')) n.setEvent(EventType.MESSAGE);
                        else if (ev.$type.includes('Signal')) n.setEvent(EventType.SIGNAL);
                    }
                }*/
            }
            return n;
        };

        let getOrCreateEdge = function (flow) {
            let id = flow.id;
            if (!(id in edges)) {
                edges[id] = new Edge(id,
                    getOrCreateNode(flow.source),
                    getOrCreateNode(flow.target)
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