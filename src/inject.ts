import "./inject.css"
import { Editor } from "./types"
import { getOptions, debounce } from "./utils"

const run = async () => {
  const OPTIONS = await getOptions()

  function debug(...args: unknown[]) {
    // eslint-disable-next-line no-console
    if (OPTIONS.showDebugMessages) console.log.apply(null, ["[OPEN-IN-IDE EXTENSION]", ...args])
  }

  const EDITORS: {
    [e in Editor]: { name: string; icon: string; openIDE: (repo: string, file: string, line?: string) => string }
  } = {
    vscode: {
      name: "VS Code",
      icon: "icons/vscode32.png",
      openIDE: (repo: string, file: string, line?: string) => {
        const url = `vscode://file/${OPTIONS.localPathForRepositories}/${repo}/${file}${line ? `:${line}` : ""}`
        location.href = url
        return url
      }
    },
    vscodium: {
      name: "VSCodium",
      icon: "icons/vscodium32.png",
      openIDE: (repo: string, file: string, line?: string) => {
        const url = `vscodium://file/${OPTIONS.localPathForRepositories}/${repo}/${file}${line ? `:${line}` : ""}`
        location.href = url
        return url
      }
    },
    "vscode-insiders": {
      name: "VS Code Insiders",
      icon: "icons/vscode-insiders32.png",
      openIDE: (repo: string, file: string, line?: string) => {
        const url = `vscode-insiders://file/${OPTIONS.localPathForRepositories}/${repo}/${file}${line ? `:${line}` : ""}`
        location.href = url
        return url
      }
    },
    phpstorm: {
      name: "PhpStorm",
      icon: "icons/phpstorm32.png",
      openIDE: (repo: string, file: string, line?: string) => {
        const url = `phpstorm://open?file=${OPTIONS.localPathForRepositories}/${repo}/${file}${line ? `:${line}` : ""}`
        location.href = url
        return url
      }
    },
    "intellij-idea": {
      name: "IntelliJ IDEA",
      icon: "icons/intellij-idea32.png",
      openIDE: (repo: string, file: string, line?: string) => {
        const url = `idea://open?file=${OPTIONS.localPathForRepositories}/${repo}/${file}${line ? `:${line}` : ""}`
        location.href = url
        return url
      }
    },
    webstorm: {
      name: "WebStorm",
      icon: "icons/webstorm32.png",
      openIDE: (repo: string, file: string, line?: string) => {
        const url = `webstorm://open?file=${OPTIONS.localPathForRepositories}/${repo}/${file}${line ? `:${line}` : ""}`
        location.href = url
        return url
      }
    },
    pycharm: {
      name: "Pycharm (Built-in web server)",
      icon: "icons/intellij-idea32.png",
      openIDE: (repo: string, file: string, line?: string) => {
        const url = `http://localhost:63342/api/file?file=${OPTIONS.localPathForRepositories}/${repo}/${file}&line=${line ? `${line}` : "1"}`
        const Http = new XMLHttpRequest();
        Http.open("GET", url)
        Http.send();
        return url
      }
    },
  }

  const generateIconElement = (repo: string, file: string, lineNumber?: string | null) => {
    const editorIconSpanElement = document.createElement("span")
    const filename = file.split("/").pop() as string
    let iconTitle = `Open ${filename} in ${EDITORS[OPTIONS.defaultIde].name}`
    if (lineNumber) iconTitle = `${iconTitle} at line ${lineNumber}`
    editorIconSpanElement.title = iconTitle
    editorIconSpanElement.classList.add("open-in-ide-icon")

    const editorIconImgElement = document.createElement("img")
    editorIconImgElement.src = chrome.extension.getURL(EDITORS[OPTIONS.defaultIde].icon)
    editorIconSpanElement.appendChild(editorIconImgElement)

    editorIconSpanElement.addEventListener("click", e => {
      e.preventDefault()
      const editorUrl = EDITORS[OPTIONS.defaultIde].openIDE(repo, file, lineNumber ?? undefined)
      debug(`Opened ${editorUrl}`)
    })
    return editorIconSpanElement
  }

  const filePathRegExp = /.+\/([^/]+)\/(blob|tree)\/[^/]+\/(.*)/

  const addEditorIcons = () => {
    debug("Adding editor icons")

    let addedIconsCounter = 0

    // -------------------------------
    // repository content (files list)
    // -------------------------------

    if (OPTIONS.showIconInFileTree) {
      const files = document.querySelectorAll(
        '[aria-labelledby="files"].js-navigation-container > .Box-row.js-navigation-item .css-truncate',
      )

      files.forEach(fileElement => {
        // don't add a new icon if icon already exists
        if (fileElement.parentNode?.querySelector(".open-in-ide-icon")) return

        const fileUrl = fileElement.querySelector("a")?.getAttribute("href")
        if (!fileUrl || !filePathRegExp.test(fileUrl)) return

        const pathInfo = filePathRegExp.exec(fileUrl)
        const repo = pathInfo?.[1]
        const file = pathInfo?.[3]
        if (!repo || !file) return

        const editorIconElement = generateIconElement(repo, file)
        editorIconElement.classList.add("open-in-ide-icon-file-explorer")

        fileElement.parentNode?.insertBefore(editorIconElement, fileElement.nextSibling)
        addedIconsCounter++
      })
    }

    // --------------------------------------------
    // file links (file changes view & discussions)
    // --------------------------------------------

    if (OPTIONS.showIconOnFileBlockHeaders || OPTIONS.showIconOnLineNumbers) {
      // select file blocks
      const grayDarkLinks = document.querySelectorAll(".file-header a.link-gray-dark[title]")

      const repo = window.location.href.split("/")[4]

      grayDarkLinks.forEach(linkElement => {
        const file = linkElement
          .getAttribute("title")
          ?.split("→") // when file was renamed
          .pop()
          ?.trim()

        // no file found
        if (!file) return

        let lineNumberForFileBlock
        let fileElement

        try {
          // in discussion
          fileElement = linkElement.parentNode?.parentNode as Element | undefined
          if (!fileElement?.classList.contains("file")) throw Error()
          const lineNumberNodes = fileElement.querySelectorAll("td[data-line-number]")
          // get last line number
          lineNumberForFileBlock = lineNumberNodes[lineNumberNodes.length - 1].getAttribute("data-line-number")
        } catch (err1) {
          try {
            // in changed files
            fileElement = linkElement.parentNode?.parentNode?.parentNode as Element | undefined
            if (!fileElement?.classList.contains("file")) throw Error()
            const firstLineNumberNode = fileElement.querySelector(
              "td.blob-num-deletion[data-line-number], td.blob-num-addition[data-line-number]",
            )
            // get first line number
            lineNumberForFileBlock = firstLineNumberNode?.getAttribute("data-line-number")
          } catch (err2) {
            // no line number available
          }
        }

        if (
          OPTIONS.showIconOnFileBlockHeaders &&
          // don't add a new icon if icon already exists
          !linkElement.parentNode?.querySelector(".open-in-ide-icon")
        ) {
          const editorIconElement = generateIconElement(repo, file, lineNumberForFileBlock)

          linkElement.parentNode?.insertBefore(editorIconElement, null)
          addedIconsCounter++
        }

        // add icon on each line number
        if (OPTIONS.showIconOnLineNumbers && fileElement) {
          const clickableLineNumbersNodes = fileElement.querySelectorAll(
            "td.blob-num.js-linkable-line-number[data-line-number]",
          )

          clickableLineNumbersNodes.forEach(lineNumberNode => {
            // don't add a new icon if icon already exists
            if (lineNumberNode.querySelector(".open-in-ide-icon")) return

            const lineNumber = lineNumberNode.getAttribute("data-line-number")

            const editorIconElement = generateIconElement(repo, file, lineNumber)

            lineNumberNode.appendChild(editorIconElement)
            addedIconsCounter++
          })
        }
      })
    }

    debug(`Added ${addedIconsCounter} new editor icons`)
  }

  // observe content changes
  const observeChanges = () => {
    debug("Observing page changes")

    const content = document.querySelector(".repository-content")

    if (content)
      pageChangeObserver.observe(content, {
        childList: true,
        subtree: true,
      })
  }

  // inject CSS rules for GitHub elements
  const styleNode = document.createElement("style")

  if (OPTIONS.showIconInFileTree)
    // resize file names to leave some space for the icon
    styleNode.innerHTML += `.files.js-navigation-container > tbody tr.js-navigation-item .content .css-truncate {
      max-width: calc(100% - 22px);
    }`

  if (OPTIONS.showIconOnLineNumbers)
    // hide file numbers on hover
    styleNode.innerHTML += `.file tr:hover td.blob-num.js-linkable-line-number::before {
      display: none;
    }`

  document.body.appendChild(styleNode)

  // set up an observer
  const pageChangeObserver = new MutationObserver(function (mutations) {
    mutations.forEach(
      debounce(function (mutation: MutationRecord) {
        // prevent recursive mutation observation
        if ((mutation.target as Element).querySelector(":scope > .open-in-ide-icon")) return
        debug("Detected page changes:")
        debug(mutation.target)
        addEditorIcons()
        observeChanges()
      }),
    )
  })

  addEditorIcons()
  observeChanges()

  // observe route change
  const title = document.querySelector("head > title")
  if (title)
    pageChangeObserver.observe(title, {
      childList: true,
    })
}

void run()
