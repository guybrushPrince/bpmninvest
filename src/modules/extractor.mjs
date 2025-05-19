import { BPMNModel, Edge, End, EventType, Gateway, MessageFlow, Process, Start, Task } from "./model.mjs";
import { flatten } from "array-flatten";

const ModelExtractor = (function () {

    function ModelExtractorFactory() {
        let nodes = {};
        let edges = {};

        this.extractDiagram = function(modeler) {
            let elements = modeler.get('elementRegistry').getAll();
            console.log(elements);
            let collaborations = findCollaborations(elements);
            if (collaborations.length === 0) {
                collaborations = findProcessLike(elements);
            }
            console.log('Collaborations', collaborations);
            let processes = identifyProcesses(collaborations);
            console.log('Processes', processes);
            let iProcesses = createInternProcesses(processes);
            console.log('Created processes', iProcesses);

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
            console.log(nodesAndFlows)
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


/*let extractDiagram = function (diagram, index) {
    // The diagram model.
    let m = new BPMNModel(diagram.id);

    let nodes = {};
    let edges = {};

    let getOrCreateNode = function (id, type) {
        if (!(id in nodes)) {
            if (type.includes('Task')) nodes[id] = new Task(id, type);
            else if (type.includes('Start')) nodes[id] = new Start(id, type);
            else if (type.includes('End')) nodes[id] = new End(id, type);
            else if (type.includes('Gateway')) nodes[id] = new Gateway(id, type);
            else console.log([id, type]);
        }
        return nodes[id];
    };
    let getOrCreateDetailedNode = function (node) {
        let n = getOrCreateNode(node.id, node.$type);
        if (n instanceof Start) {
            if ('eventDefinitions' in node && Array.isArray(node.eventDefinitions)) {
                for (let ev of node.eventDefinitions) {
                    if (ev.$type.includes('Timer')) n.setEvent(EventType.TIMER);
                    else if (ev.$type.includes('Conditional')) n.setEvent(EventType.CONDITIONAL);
                    else if (ev.$type.includes('Message')) n.setEvent(EventType.MESSAGE);
                    else if (ev.$type.includes('Signal')) n.setEvent(EventType.SIGNAL);
                }
            }
        }
        return n;
    };
    let getOrCreateEdge = function (flow) {
        let id = flow.id;
        if (!(id in edges)) {
            edges[id] = new Edge(id,
                getOrCreateNode(flow.sourceRef.id, flow.sourceRef.$type),
                getOrCreateNode(flow.targetRef.id, flow.targetRef.$type)
            );
        }
        return edges[id];
    };

    let findElements = function (p, elements) {
        elements.forEach(function (el) {
            let type = el.$type;
            if (type.includes('SequenceFlow')) {
                p.addEdge(getOrCreateEdge(el));
            } else { // It is a node
                p.addNode(getOrCreateDetailedNode(el));
            }
        });
    };

    if ('plane' in diagram) {
        let plane = diagram.plane;
        if ('bpmnElement' in plane) {
            let container = plane.bpmnElement;
            if ('messageFlows' in container && Array.isArray(container.messageFlows)) {
                m.setMessages(container.messageFlows.map(function (flow) {
                    return new MessageFlow(flow.id,
                        getOrCreateNode(flow.sourceRef.id, flow.sourceRef.$type),
                        getOrCreateNode(flow.targetRef.id, flow.targetRef.$type)
                    );
                }));
            }
            if ('participants' in container && Array.isArray(container.participants)) {
                m.setProcesses(container.participants.map(function (process) {
                    let p = new Process(process.id);
                    findElements(p, process.processRef.flowElements);
                    p.computeInOut();
                    return p;
                }));
            }
        } else if ('planeElement' in plane) {

        }
    }
    return m;
};*/
/*let analyze = function () {
    //let modeler = null;
    /*if (typeof bpmnio !== 'undefined') {
        if ('modeler' in bpmnio) {
            modeler = bpmnio.modeler;
        }
    } else if (typeof bpmnModeler !== undefined) {
        modeler = bpmnModeler;
    }*/
    /*let definitions = modeler.getDefinitions();
    console.log(definitions);*/
    /*if ('_definitions' in modeler) {
        let definitions = modeler._definitions;
        if ('diagrams' in definitions) {
            let diagrams = definitions.diagrams;
            if (Array.isArray(diagrams)) {
                let exp = diagrams.map(extractDiagram);
                console.log(exp);
                return exp;
            }
        }
    }*/
/*    return null;
};*/
export default ModelExtractor;