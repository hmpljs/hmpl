"use strict";

import {
  HMPLNodeObj,
  HMPLRenderFunction,
  HMPLRequest,
  HMPLRequestFunction,
  HMPLRequestOptions,
  HMPLInstance,
  HMPLIdentificationOptions,
  HMPLCompile,
  HMPLTemplateFunction,
  HMPLData,
  HMPLElement
} from "./types";

const checkObject = (val: any) => {
  return typeof val === "object" && !Array.isArray(val) && val !== null;
};
const checkFunction = (val: any) => {
  return Object.prototype.toString.call(val) === "[object Function]";
};
const createError = (text: string) => {
  throw new Error(text);
};
const createWarning = (text: string) => {
  console.warn(text);
};
const getIsMethodValid = (method: string) => {
  return (
    method !== "get" &&
    method !== "post" &&
    method !== "put" &&
    method !== "delete" &&
    method !== "patch"
  );
};
const NODE_NAME = "REQUEST";
const SOURCE_ATTR = `src`;
const METHOD_ATTR = `method`;
const ID_ATTR = `ref`;
const AFTER_ATTR = `after`;
const MODE_ATTR = `mode`;

const getResponseElements = (response: string) => {
  if (typeof response !== "string") createError("Bad response");
  const elementDocument = new DOMParser().parseFromString(
    `<template>${response}</template>`,
    "text/html"
  );
  const elWrapper = elementDocument.childNodes[0].childNodes[0].firstChild;
  const elContent = elWrapper!["content"];
  const scripts = elContent.querySelectorAll("script");
  for (let i = 0; i < scripts.length; i++) {
    const currentScript = scripts[i];
    elContent.removeChild(currentScript);
  }
  return elWrapper;
};
const makeRequest = (
  el: undefined | Element,
  mainEl: undefined | Element,
  dataObj: HMPLNodeObj | undefined,
  method: string,
  source: string,
  isRequest: boolean,
  isRequests: boolean,
  options: HMPLRequestOptions = {},
  templateObject: HMPLInstance,
  reqObject?: HMPLRequest
) => {
  const {
    mode,
    cache,
    redirect,
    get,
    referrerPolicy,
    signal,
    credentials,
    timeout,
    referrer,
    headers,
    body,
    window: windowOption,
    integrity
  } = options;
  const initRequest: RequestInit = {
    method: method.toUpperCase()
  };
  if (credentials !== undefined) {
    initRequest.credentials = credentials;
  }
  if (body !== undefined) {
    initRequest.body = body;
  }
  if (mode !== undefined) {
    initRequest.mode = mode;
  }
  if (cache !== undefined) {
    initRequest.cache = cache;
  }
  if (redirect !== undefined) {
    initRequest.redirect = redirect;
  }
  if (referrerPolicy !== undefined) {
    initRequest.referrerPolicy = referrerPolicy;
  }
  if (integrity !== undefined) {
    initRequest.integrity = integrity;
  }
  if (referrer !== undefined) {
    initRequest.referrer = referrer;
  }
  const isHaveSignal = signal !== undefined;
  if (isHaveSignal) {
    initRequest.signal = signal;
  }
  if (windowOption !== undefined) {
    initRequest.window = windowOption;
  }
  if ((options as any).keepalive !== undefined) {
    createWarning("keepalive property is not yet supported");
  }
  if (headers) {
    if (checkObject(headers)) {
      const newHeaders = new Headers();
      for (const header in headers) {
        const [key, value] = header;
        if (typeof value === "string") {
          try {
            newHeaders.set(key, value);
          } catch (e) {
            throw e;
          }
        } else {
          createError(`Header has no string value`);
        }
      }
      initRequest.headers = newHeaders;
    } else {
      createError(`The "header" property does not have a value object`);
    }
  }
  if (timeout) {
    if (!isHaveSignal) {
      initRequest.signal = AbortSignal.timeout(timeout);
    } else {
      createWarning(
        "The signal property overwrote the AbortSignal from timeout"
      );
    }
  }
  const updateStatus = (status: number) => {
    if (isRequests) {
      if (reqObject!.status !== status) {
        reqObject!.status = status;
        get?.("status", status, reqObject);
      }
    } else {
      if (templateObject.status !== status) {
        templateObject.status = status;
        get?.("status", status);
      }
    }
  };
  updateStatus(0);
  fetch(source, initRequest)
    .then((response) => {
      updateStatus(response.status);
      if (!response.ok) {
        createError(`Request error with code ${response.status}`);
      }
      return response.text();
    })
    .then((data) => {
      const templateWrapper = getResponseElements(data);
      if (isRequest) {
        (templateObject.response as any) = templateWrapper;
        get?.("response", templateWrapper);
      } else {
        let reqResponse: ChildNode[] = [];
        const nodes = (templateWrapper as HTMLTemplateElement).content
          .childNodes;
        if (dataObj) {
          if (dataObj.nodes) {
            const parentNode = dataObj.parentNode! as ParentNode;
            if (!parentNode) createError("parentNode is null");
            const newNodes: ChildNode[] = [];
            const nodesLength = dataObj.nodes.length;
            for (let i = 0; i < nodesLength; i++) {
              const node = dataObj.nodes[i];
              if (i === nodesLength - 1) {
                for (let j = 0; j < nodes.length; j++) {
                  const reqNode = nodes[j];
                  const newNode = parentNode.insertBefore(reqNode, node);
                  newNodes.push(newNode);
                }
              }
              parentNode.removeChild(node);
            }
            reqResponse = newNodes.slice();
            dataObj.nodes = newNodes;
          } else {
            const parentNode = el!.parentNode as ParentNode;
            const newNodes: ChildNode[] = [];
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i];
              const newNode = parentNode.insertBefore(node, el!);
              newNodes.push(newNode);
            }
            parentNode.removeChild(el!);
            reqResponse = newNodes.slice();
            dataObj.nodes = newNodes;
            dataObj.parentNode = parentNode;
          }
        } else {
          const parentNode = el!.parentNode as ParentNode;
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const reqNode = parentNode.insertBefore(node, el!);
            if (isRequests) {
              reqResponse.push(reqNode);
            }
          }
          parentNode.removeChild(el!);
        }
        if (isRequests) {
          reqObject!.response = reqResponse;
          get?.("response", reqResponse, reqObject);
        }
        get?.("response", mainEl);
      }
    })
    .catch((error) => {
      throw error;
    });
};
const renderTemplate = (
  currentEl: Element,
  fn: HMPLRenderFunction,
  isRequest: boolean = false
) => {
  const renderEl = (el: Element, mainEl?: Element) => {
    const source = el.getAttribute(SOURCE_ATTR);
    if (source) {
      const method = (el.getAttribute(METHOD_ATTR) || "GET").toLowerCase();
      if (getIsMethodValid(method)) {
        createError(
          `${METHOD_ATTR} has only GET, POST, PUT, PATCH or DELETE values`
        );
      } else {
        const after = el.getAttribute(AFTER_ATTR);
        if (after && isRequest) createError("EventTarget is undefined");
        const oldMode = el.getAttribute(MODE_ATTR);
        const modeAttr = (oldMode || "all").toLowerCase();
        if (modeAttr !== "one" && modeAttr !== "all")
          createError(`${MODE_ATTR} has only ONE or ALL values`);
        const optionsId = el.getAttribute(ID_ATTR);
        const isAll = modeAttr === "all";
        let nodeId = -1;
        if (mainEl) {
          let id = -2;
          const getNodeId = (currentEl: ChildNode) => {
            id++;
            if (currentEl === el) {
              nodeId = id;
              return true;
            } else {
              for (let i = 0; i < currentEl.childNodes.length; i++) {
                const newNode = currentEl.childNodes.item(i);
                if (newNode.nodeType === Node.ELEMENT_NODE) {
                  if (getNodeId(newNode)) {
                    break;
                  }
                }
              }
            }
          };
          getNodeId(mainEl);
        }
        const getOptions = (
          options: HMPLRequestOptions | HMPLIdentificationOptions[],
          isArray: boolean = false
        ): HMPLRequestOptions => {
          if (isArray) {
            if (optionsId) {
              let result: HMPLRequestOptions | undefined;
              for (
                let i = 0;
                i < (options as HMPLIdentificationOptions[]).length;
                i++
              ) {
                const currentOptions = options[i] as HMPLIdentificationOptions;
                if (currentOptions.id === optionsId) {
                  result = currentOptions.options;
                  break;
                }
              }
              if (!result) {
                createError("id referenced by request not found");
              }
              return result as HMPLRequestOptions;
            } else {
              return {};
            }
          } else {
            if (optionsId) createError("id referenced by request not found");
            return options as HMPLRequestOptions;
          }
        };
        const isDataObj = isAll && after;
        const reqFunction: HMPLRequestFunction = (
          reqEl,
          options,
          templateObject,
          data,
          reqMainEl,
          isArray = false,
          reqObject,
          isRequests = false,
          currentHMPLElement
        ) => {
          const id = data.currentId;
          if (isRequest) {
            if (!reqEl) reqEl = mainEl!;
          } else {
            if (!reqEl) {
              if (currentHMPLElement) {
                reqEl = currentHMPLElement.el;
              } else {
                let currentEl: Element | undefined;
                const { els } = data;
                for (let i = 0; i < els.length; i++) {
                  const e = els[i];
                  if (e.id === nodeId) {
                    currentHMPLElement = e;
                    currentEl = e.el;
                    break;
                  }
                }
                if (!currentEl) {
                  createError("Element error");
                }
                reqEl = currentEl!;
              }
            }
          }
          let dataObj: HMPLNodeObj;
          if (isDataObj) {
            if (!currentHMPLElement) createError("Element error");
            dataObj = currentHMPLElement!.objNode!;
            if (!dataObj!) {
              dataObj = {
                id,
                nodes: null,
                parentNode: null
              };
              currentHMPLElement!.objNode = dataObj;
              data.dataObjects.push(dataObj);
              data.currentId++;
            }
          }
          const currentOptions = getOptions(options, isArray);
          makeRequest(
            reqEl,
            reqMainEl,
            dataObj!,
            method,
            source,
            isRequest,
            isRequests,
            currentOptions,
            templateObject,
            reqObject
          );
        };
        let requestFunction = reqFunction;
        if (after) {
          const setEvents = (
            reqEl: Element,
            event: string,
            selector: string,
            options: HMPLRequestOptions | HMPLIdentificationOptions[],
            templateObject: HMPLInstance,
            data: HMPLData,
            isArray: boolean,
            isRequests: boolean,
            reqMainEl?: Element,
            reqObject?: HMPLRequest,
            currentHMPLElement?: HMPLElement
          ) => {
            const els = reqMainEl!.querySelectorAll(selector);
            if (els.length === 0) {
              createError("Selectors nodes not found");
            }
            const afterFn = isAll
              ? () => {
                  reqFunction(
                    reqEl,
                    options,
                    templateObject,
                    data,
                    reqMainEl,
                    isArray,
                    reqObject,
                    isRequests,
                    currentHMPLElement
                  );
                }
              : () => {
                  reqFunction(
                    reqEl,
                    options,
                    templateObject,
                    data,
                    reqMainEl,
                    isArray,
                    reqObject,
                    isRequests,
                    currentHMPLElement
                  );
                  for (let j = 0; j < els.length; j++) {
                    const currentAfterEl = els[j];
                    currentAfterEl.removeEventListener(event, afterFn);
                  }
                };
            for (let i = 0; i < els.length; i++) {
              const afterEl = els[i];
              afterEl.addEventListener(event, afterFn);
            }
          };
          if (after.indexOf(":") > 0) {
            const afterArr = after.split(":");
            const event = afterArr[0];
            const selector = afterArr.slice(1).join(":");
            requestFunction = (
              reqEl,
              options,
              templateObject,
              data,
              reqMainEl,
              isArray: boolean = false,
              reqObject,
              isRequests = false,
              currentHMPLElement
            ) => {
              const currentOptions = getOptions(options, isArray);
              setEvents(
                reqEl,
                event,
                selector,
                currentOptions,
                templateObject,
                data,
                isArray,
                isRequests,
                reqMainEl,
                reqObject,
                currentHMPLElement
              );
            };
          } else {
            createError(
              `${AFTER_ATTR} attribute doesn't work without EventTargets`
            );
          }
        } else {
          if (oldMode) {
            createError(
              `${MODE_ATTR} attribute doesn't work without ${AFTER_ATTR}`
            );
          }
        }
        return requestFunction;
      }
    } else {
      createError(`The "source" attribute are not found or empty`);
    }
  };

  let reqFn: any;
  if (isRequest) {
    reqFn = renderEl(currentEl);
  } else {
    const requests = currentEl.querySelectorAll(`${NODE_NAME}`);
    if (requests.length === 0) {
      createError(`${NODE_NAME} not found`);
    }
    const algorithm: HMPLRequestFunction[] = [];
    for (let i = 0; i < requests.length; i++) {
      const currentReqEl = requests[i];
      algorithm.push(renderEl(currentReqEl, currentEl)!);
    }
    if (requests.length > 1) {
      reqFn = (
        reqEl: Element,
        options: HMPLRequestOptions | HMPLIdentificationOptions[],
        templateObject: HMPLInstance,
        data: HMPLData,
        mainEl: Element,
        isArray: boolean = false
      ) => {
        if (!reqEl) {
          reqEl = mainEl;
        }
        const requests: HMPLRequest[] = [];
        const els = data.els;
        for (let i = 0; i < els.length; i++) {
          const hmplElement = els[i];
          const currentReqEl = hmplElement.el;
          if (currentReqEl.parentNode === null) {
            createError(`"parentNode" is null`);
          }
          const currentReqFn = algorithm[i];
          const currentReq: HMPLRequest = {
            response: undefined,
            status: 0
          };
          currentReqFn!(
            currentReqEl,
            options,
            templateObject,
            data,
            reqEl,
            isArray,
            currentReq,
            true,
            hmplElement
          );
          requests.push(currentReq);
        }
        templateObject.requests = requests;
      };
    } else {
      const el = requests[0];
      if (el.parentNode === null) {
        createError(`"parentNode" is null`);
      }
      reqFn = renderEl(el, currentEl);
    }
  }
  return fn(reqFn!);
};
const validOptions = (currentOptions: HMPLRequestOptions) => {
  if (currentOptions.get) {
    if (!checkFunction(currentOptions.get)) {
      createError("The get property has a function value");
    }
  }
};
const validIdentificationOptionsArray = (
  currentOptions: HMPLIdentificationOptions[]
) => {
  const ids: string[] = [];
  for (let i = 0; i < currentOptions.length; i++) {
    const idOptions = currentOptions[i];
    if (!checkObject(idOptions)) createError(`options is of type "object"`);
    validOptions(idOptions as HMPLRequestOptions);
    const { id } = idOptions;
    if (typeof idOptions.id !== "string") createError(`id is of type "string"`);
    if (ids.indexOf(id) > -1) {
      createError(`id with value "${id}" already exists`);
    } else {
      ids.push(id);
    }
  }
};
export const compile: HMPLCompile = (template: string) => {
  if (typeof template !== "string")
    createError(
      "template was not found or the type of the passed value is not string"
    );
  if (!template) createError("template empty");
  const getElement = (template: string) => {
    const elementDocument = new DOMParser().parseFromString(
      `<template>${template}</template>`,
      "text/html"
    );
    const elWrapper = elementDocument.childNodes[0].childNodes[0]
      .firstChild as HTMLTemplateElement;
    if (elWrapper.content.children.length > 1) {
      createError("Template include only one node with type 'Element'");
    }
    const prepareNode = (node: ChildNode) => {
      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          if ((node as Element).tagName === "pre") return;
          break;
        case Node.TEXT_NODE:
          if (!/\S/.test(node.textContent!)) {
            node.remove();
            return;
          }
          break;
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        prepareNode(node.childNodes.item(i));
      }
    };
    prepareNode(elWrapper.content.childNodes[0]);
    const currentEl = elWrapper.content.firstElementChild;
    if (!currentEl) createError("Element is undefined");
    return currentEl;
  };
  const templateEl = getElement(template);
  const isRequest = templateEl!.nodeName === NODE_NAME;
  const renderFn: HMPLRenderFunction = (
    requestFunction: HMPLRequestFunction
  ) => {
    const templateFunction: HMPLTemplateFunction = (
      options: HMPLIdentificationOptions[] | HMPLRequestOptions = {}
    ): HMPLInstance => {
      const el = templateEl!.cloneNode(true) as Element;
      const templateObject: HMPLInstance = {
        response: isRequest ? undefined : el
      };
      if (isRequest) {
        templateObject.status = 0;
      }
      const data: HMPLData = {
        dataObjects: [],
        els: [],
        currentId: 0
      };
      if (!isRequest) {
        let id = -2;
        const getEls = (currentEl: ChildNode) => {
          id++;
          if (currentEl.nodeName === NODE_NAME) {
            const elObj: HMPLElement = {
              el: currentEl as Element,
              id
            };
            data.els.push(elObj);
          } else {
            for (let i = 0; i < currentEl.childNodes.length; i++) {
              const newNode = currentEl.childNodes.item(i);
              if (newNode.nodeType === Node.ELEMENT_NODE) {
                getEls(newNode);
              }
            }
          }
        };
        getEls(el);
      }
      if (checkObject(options)) {
        validOptions(options as HMPLRequestOptions);
        requestFunction(
          undefined!,
          options as HMPLRequestOptions,
          templateObject,
          data,
          el
        );
      } else if (Array.isArray(options)) {
        validIdentificationOptionsArray(options as HMPLIdentificationOptions[]);
        requestFunction(
          undefined!,
          options as HMPLIdentificationOptions[],
          templateObject,
          data,
          el,
          true
        );
      }
      return templateObject;
    };
    return templateFunction;
  };
  return renderTemplate(templateEl as Element, renderFn, isRequest);
};
