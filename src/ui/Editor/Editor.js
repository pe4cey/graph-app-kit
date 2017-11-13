/* eslint-disable no-octal-escape */
import React, { Component } from "react";
import { findDOMNode } from "react-dom";
import * as PropTypes from "prop-types";
import { Container, Button } from "semantic-ui-react";
import Codemirror from "./Codemirror";
import * as schemaConvert from "./editorSchemaConverter";
import cypherFunctions from "./cypher/functions";
import consoleCommands from "./language/consoleCommands";
import { Render } from "./../Render";

export class Editor extends Component {
  constructor(props) {
    super(props);
    this.onExecute = this.props.onExecute || (() => {});
    this.onFavoriteUpdateClick = this.props.eventHandler
      ? this.props.eventHandler.onFavoriteUpdateClick || (() => {})
      : () => {};
    this.schema = {
      consoleCommands: consoleCommands,
      parameters: this.parameters || [],
      labels: this.props.labels
        ? this.props.labels.map(schemaConvert.toLabel)
        : [],
      relationshipTypes: this.props.relationshipTypes
        ? this.props.relationshipTypes.map(schemaConvert.toRelationshipType)
        : [],
      propertyKeys: this.props.properties
        ? this.props.properties.map(schemaConvert.toPropertyKey)
        : [],
      functions: this.props.functions
        ? this.props.functions.map(schemaConvert.toFunction)
        : [...cypherFunctions],
      procedures: this.props.procedures
        ? this.props.procedures.map(schemaConvert.toProcedure)
        : []
    };
    this.state = {
      historyIndex: -1,
      buffer: "",
      mode: "cypher",
      notifications: [],
      expanded: false,
      lastPosition: { line: 0, column: 0 }
    };
  }

  focusEditor() {
    this.codeMirror.focus();
    this.codeMirror.setCursor(this.codeMirror.lineCount(), 0);
  }

  expandEditorToggle() {
    this.setState({ expanded: !this.state.expanded });
  }

  clearEditor() {
    this.setEditorValue("");
    this.setContentId(null);
  }

  handleEnter(cm) {
    if (cm.lineCount() === 1) {
      return this.execCurrent(cm);
    }
    this.newlineAndIndent(cm);
  }

  newlineAndIndent(cm) {
    cm.execCommand("newlineAndIndent");
  }

  execCurrent() {
    const value = this.getEditorValue();
    if (!value) return;
    this.onExecute(value);
    this.clearEditor();
    this.clearHints();
    this.setState({ historyIndex: -1, buffer: null, expanded: false });
  }

  moveCursorToEndOfLine(cm) {
    cm.setCursor(cm.lineCount(), 0);
  }

  handleUp(cm) {
    if (cm.lineCount() === 1) {
      this.historyPrev(cm);
      this.moveCursorToEndOfLine(cm);
    } else {
      cm.execCommand("goLineUp");
    }
  }

  handleDown(cm) {
    if (cm.lineCount() === 1) {
      this.historyNext(cm);
      this.moveCursorToEndOfLine(cm);
    } else {
      cm.execCommand("goLineDown");
    }
  }

  historyPrev(cm) {
    if (!this.props.history.length) return;
    if (this.state.historyIndex + 1 === this.props.history.length) return;
    if (this.state.historyIndex === -1) {
      // Save what's currently in the editor
      this.setState({ buffer: cm.getValue() });
    }
    this.setState({
      historyIndex: this.state.historyIndex + 1,
      editorHeight: this.editor && findDOMNode(this.editor).clientHeight
    });
    this.setEditorValue(this.props.history[this.state.historyIndex]);
  }

  historyNext(cm) {
    if (!this.props.history.length) return;
    if (this.state.historyIndex <= -1) return;
    if (this.state.historyIndex === 0) {
      // Should read from buffer
      this.setState({ historyIndex: -1 });
      this.setEditorValue(this.state.buffer);
      return;
    }
    this.setState({
      historyIndex: this.state.historyIndex - 1,
      editorHeight: this.editor && findDOMNode(this.editor).clientHeight
    });
    this.setEditorValue(this.props.history[this.state.historyIndex]);
  }

  triggerAutocompletion(cm, changed) {
    debugger;
    if (changed.text.length !== 1 || !this.props.enableEditorAutocomplete) {
      return;
    }

    const text = changed.text[0];
    const triggerAutocompletion =
      text === "." ||
      text === ":" ||
      text === "[]" ||
      text === "()" ||
      text === "{}" ||
      text === "[" ||
      text === "(" ||
      text === "{";
    if (triggerAutocompletion) {
      cm.execCommand("autocomplete");
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.content !== null &&
      nextProps.content !== this.getEditorValue()
    ) {
      this.setEditorValue(nextProps.content);
    }
  }

  componentDidMount() {
    // this.debouncedCheckForHints = debounce(this.checkForHints, 350, this)
    this.codeMirror = this.editor.getCodeMirror();
    this.codeMirror.on("change", this.triggerAutocompletion.bind(this));

    if (this.props.content) {
      this.setEditorValue(this.props.content);
    }

    if (this.props.bus) {
      this.props.bus.take(SET_CONTENT, msg => {
        this.setContentId(null);
        this.setEditorValue(msg.message);
      });
      this.props.bus.take(EDIT_CONTENT, msg => {
        this.setContentId(msg.id);
        this.setEditorValue(msg.message);
      });
      this.props.bus.take(FOCUS, this.focusEditor.bind(this));
      this.props.bus.take(EXPAND, this.expandEditorToggle.bind(this));
    }
  }

  getEditorValue() {
    return this.codeMirror ? this.codeMirror.getValue().trim() : "";
  }

  setEditorValue(cmd) {
    this.codeMirror.setValue(cmd);
    this.updateCode(cmd, undefined, () => {
      this.focusEditor();
    });
  }

  setContentId(id) {
    this.setState({ contentId: id });
  }

  updateCode(newCode, change, cb = () => {}) {
    const mode = "cypher";
    this.clearHints();
    if (
      mode === "cypher" &&
      newCode.trim().length > 0 &&
      !newCode
        .trimLeft()
        .toUpperCase()
        .startsWith("EXPLAIN") &&
      !newCode
        .trimLeft()
        .toUpperCase()
        .startsWith("PROFILE")
    ) {
      // this.debouncedCheckForHints(newCode);
    }

    const lastPosition = change && change.to;

    this.setState(
      {
        mode,
        lastPosition: lastPosition
          ? { line: lastPosition.line, column: lastPosition.ch }
          : this.state.lastPosition,
        editorHeight: this.editor && findDOMNode(this.editor).clientHeight
      },
      cb
    );
  }

  // checkForHints(code) {
  //   this.props.bus.self(
  //     CYPHER_REQUEST,
  //     { query: "EXPLAIN " + code },
  //     response => {
  //       if (
  //         response.success === true &&
  //         response.result.summary.notifications.length > 0
  //       ) {
  //         this.setState({
  //           notifications: response.result.summary.notifications
  //         });
  //       } else {
  //         this.clearHints();
  //       }
  //     }
  //   );
  // }

  clearHints() {
    this.setState({ notifications: [] });
  }

  setGutterMarkers() {
    if (this.codeMirror) {
      this.codeMirror.clearGutter("cypher-hints");
      this.state.notifications.forEach(notification => {
        this.codeMirror.setGutterMarker(
          (notification.position.line || 1) - 1,
          "cypher-hints",
          (() => {
            let gutter = document.createElement("div");
            gutter.style.color = "#822";
            gutter.innerHTML =
              '<i class="fa fa-exclamation-triangle gutter-warning gutter-warning" aria-hidden="true"></i>';
            gutter.title = `${notification.title}\n${notification.description}`;
            gutter.onclick = () => {
              action.forceView = viewTypes.WARNINGS;
              this.props.bus.send(action.type, action);
            };
            return gutter;
          })()
        );
      });
    }
  }

  lineNumberFormatter(line) {
    if (!this.codeMirror || this.codeMirror.lineCount() === 1) {
      return "$";
    } else {
      return line;
    }
  }

  componentDidUpdate() {
    if (this.editor) {
      const editorHeight = findDOMNode(this.editor).clientHeight;
      if (editorHeight !== this.state.editorHeight) {
        this.setState({ editorHeight });
      }
    }
  }

  render() {
    const options = {
      lineNumbers: true,
      mode: this.state.mode,
      theme: "cypher",
      gutters: ["cypher-hints"],
      lineWrapping: true,
      autofocus: true,
      smartIndent: false,
      lineNumberFormatter: this.lineNumberFormatter.bind(this),
      lint: true,
      extraKeys: {
        "Ctrl-Space": "autocomplete",
        Enter: this.handleEnter.bind(this),
        "Shift-Enter": this.newlineAndIndent.bind(this),
        "Cmd-Enter": this.execCurrent.bind(this),
        "Ctrl-Enter": this.execCurrent.bind(this),
        "Cmd-Up": this.historyPrev.bind(this),
        "Ctrl-Up": this.historyPrev.bind(this),
        Up: this.handleUp.bind(this),
        "Cmd-Down": this.historyNext.bind(this),
        "Ctrl-Down": this.historyNext.bind(this),
        Down: this.handleDown.bind(this)
      },
      hintOptions: {
        completeSingle: false,
        closeOnUnfocus: false,
        alignWithWord: true,
        async: true
      },
      autoCloseBrackets: {
        explode: ""
      }
    };
    const updateCode = (val, change) => this.updateCode(val, change);

    this.setGutterMarkers();

    return (
      <Container>
        <Container>
          <Codemirror
            ref={ref => {
              this.editor = ref;
            }}
            onChange={updateCode}
            options={options}
            schema={this.schema}
            initialPosition={this.state.lastPosition}
          />
        </Container>
        <Container>
          <Render if={this.state.contentId}>
            <Button
              onClick={() =>
                this.onFavoriteUpdateClick(
                  this.state.contentId,
                  this.getEditorValue()
                )
              }
              content="Favorite"
            />
          </Render>
          <Render if={!this.state.contentId}>
            <Button content="Update favorite" />
          </Render>
          <Button onClick={() => this.clearEditor()} content="Clear" />
          <Button onClick={() => this.execCurrent()} content="Submit" />
        </Container>
      </Container>
    );

    //   <Container>
    //   <Render if={this.state.contentId}>
    //     <EditModeEditorButton
    //       onClick={() =>
    //         this.props.onFavoriteUpdateClick(
    //           this.state.contentId,
    //           this.getEditorValue()
    //         )}
    //       disabled={this.getEditorValue().length < 1}
    //       color='#ffaf00'
    //       title='Favorite'
    //       hoverIcon='&quot;\74&quot;'
    //       icon='&quot;\25&quot;'
    //     />
    //   </Render>
    //   <Render if={!this.state.contentId}>
    //     <EditorButton
    //       onClick={() => {
    //         this.props.onFavoriteClick(this.getEditorValue())
    //       }}
    //       disabled={this.getEditorValue().length < 1}
    //       title='Update favorite'
    //       hoverIcon='&quot;\58&quot;'
    //       icon='&quot;\73&quot;'
    //     />
    //   </Render>
    //   <EditorButton
    //     data-test-id='clearEditorContent'
    //     onClick={() => this.clearEditor()}
    //     disabled={this.getEditorValue().length < 1}
    //     title='Clear'
    //     hoverIcon='&quot;\e005&quot;'
    //     icon='&quot;\5e&quot;'
    //   />
    //   <EditorButton
    //     data-test-id='submitQuery'
    //     onClick={() => this.execCurrent()}
    //     disabled={this.getEditorValue().length < 1}
    //     title='Play'
    //     hoverIcon='&quot;\e002&quot;'
    //     icon='&quot;\77&quot;'
    //   />
    // </Container>
    // return (
    //   <Bar expanded={this.state.expanded} minHeight={this.state.editorHeight}>
    //     <EditorWrapper>
    //       expanded={this.state.expanded}
    //       minHeight={this.state.editorHeight}
    //     >
    //       <Codemirror
    //         ref={ref => {
    //           this.editor = ref
    //         }}
    //         onChange={updateCode}
    //         options={options}
    //         schema={this.props.schema}
    //         initialPosition={this.state.lastPosition}
    //       />
    //     </EditorWrapper>
    //
    //   </Bar>
    // )
  }
}

// const mapDispatchToProps = (dispatch, ownProps) => {
//   return {
//     onFavoriteClick: cmd => {
//       const id = uuid.v4()

//       const addAction = favorites.addFavorite(cmd, id)
//       ownProps.bus.send(addAction.type, addAction)

//       const updateAction = editContent(id, cmd)
//       ownProps.bus.send(updateAction.type, updateAction)
//     },
//     onFavoriteUpdateClick: (id, cmd) => {
//       const action = favorites.updateFavorite(id, cmd)
//       ownProps.bus.send(action.type, action)
//     },
//     onExecute: cmd => {
//       const action = executeCommand(cmd)
//       ownProps.bus.send(action.type, action)
//     }
//   }
// }

// const mapStateToProps = state => {
//   return {
//     enableEditorAutocomplete: shouldEditorAutocomplete(state),
//     content: null,
//     history: getHistory(state),
//     cmdchar: getCmdChar(state),
//     schema: {
//       consoleCommands: consoleCommands,
//       parameters: Object.keys(state.params),
//       labels: state.meta.labels.map(schemaConvert.toLabel),
//       relationshipTypes: state.meta.relationshipTypes.map(
//         schemaConvert.toRelationshipType
//       ),
//       propertyKeys: state.meta.properties.map(schemaConvert.toPropertyKey),
//       functions: [
//         ...cypherFunctions,
//         ...state.meta.functions.map(schemaConvert.toFunction)
//       ],
//       procedures: state.meta.procedures.map(schemaConvert.toProcedure)
//     }
//   }
// }

Editor.propTypes = {
  expanded: PropTypes.string,
  eventHandler: PropTypes.object,
  enableEditorAutocomplete: PropTypes.bool,
  content: PropTypes.string,
  history: PropTypes.array,
  consoleCommands: PropTypes.object,
  parameters: PropTypes.array,
  labels: PropTypes.array,
  relationshipTypes: PropTypes.array,
  propertyKeys: PropTypes.array,
  functions: PropTypes.array,
  procedures: PropTypes.array
};

export default Editor;