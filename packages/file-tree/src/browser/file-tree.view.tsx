import * as React from 'react';
import * as styles from './index.module.less';
import throttle = require('lodash.throttle');
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { IFileTreeItem, IFileTreeItemStatus } from '../common';
import { observer } from 'mobx-react-lite';
import FileTreeService from './file-tree.service';
import TreeItemStore from './file-tree-item.store';
import perfectScrollbar = require('react-perfect-scrollbar');

/**
 * 绕开Tslint类型检查的不得已操作
 * 原因：react-perfect-scrollbar 模块引入存在问题
 */
const PerfectScrollbar: any  = perfectScrollbar;

export interface IFileTreeItemRendered extends IFileTreeItem {
  indent: number;
  index?: number;
}

export const FileTree = observer(({width = '288px', height = '300px'}: {width?: string, height?: string}) => {
  const fileTreeService = useInjectable(FileTreeService);
  const files: IFileTreeItem[] = fileTreeService.files;
  const status: IFileTreeItemStatus = fileTreeService.status;
  const renderedStart: number = fileTreeService.renderedStart;
  const shouldShowNumbers = Math.ceil(parseInt(height.replace('px', ''), 10) / 22);
  const renderedEnd: number = renderedStart + shouldShowNumbers + 10;
  const FileTreeStyle = {
    position: 'absolute',
    overflow: 'hidden',
    top: '20px',
    bottom: '22px',
    left: '0',
    width,
    height,
  } as React.CSSProperties;

  const fileItems: IFileTreeItemRendered[] = extractFileItemShouldBeRendered(files, status);
  let renderedFileItems = fileItems.filter((file: IFileTreeItemRendered, index: number) => {
    return index >= renderedStart && index <= renderedEnd;
  });

  // fileTreeService.createFile();

  renderedFileItems = renderedFileItems.map((file: IFileTreeItemRendered, index: number) => {
    return {
      ...file,
      index: renderedStart + index,
    };
  });
  const selectHandler = (file: IFileTreeItem) => {
    if (file.filestat.isDirectory) {
      fileTreeService.updateFilesExpandedStatus(file);
    }
    fileTreeService.updateFilesSelectedStatus(file);
  };

  const scrollbarStyle = {
    width,
    height,
  };

  /**
   * 这里定义上下滚动的预加载内容
   * 往上滚动，上列表多渲染8个，下列表多渲染2个
   * 往下滚动，下列表多渲染8个，上列表多渲染2个
   * 引入Magic number 2 和 8
   */
  const scrollerContentStyle = {
    width,
    height: `${(fileItems.length) * 22}px`,
  };

  const scrollUpHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / 22);
    if (positionIndex > 8) {
      fileTreeService.updateRenderedStart(positionIndex - 8);
    } else {
      fileTreeService.updateRenderedStart(0);
    }
  };
  const handlerScrollUpThrottled = throttle(scrollUpHanlder, 20);

  const scrollDownHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / 22);
    if (positionIndex > 8) {
      fileTreeService.updateRenderedStart(positionIndex - 2);
    } else {
      fileTreeService.updateRenderedStart(0);
    }
  };

  const handlerScrollDownThrottled = throttle(scrollDownHanlder, 20);

  return (
    <div className={ `${styles.kt_tree} ${styles.kt_filetree}` } style={ FileTreeStyle }>
      <div className={ styles.kt_filetree_container }>
        <PerfectScrollbar
          style={ scrollbarStyle }
          onScrollUp={ handlerScrollUpThrottled }
          onScrollDown={ handlerScrollDownThrottled }
        >
          <div style={ scrollerContentStyle }>
            <FileTreeNodes files={ renderedFileItems } selectHook={ selectHandler }/>
          </div>
        </PerfectScrollbar>
      </div>
    </div>
  );
});

const FileTreeNodes = observer((
    { files, selectHook }:
    { files: IFileTreeItemRendered[], selectHook: any},
  ) => {
    const selectHandler = (file: IFileTreeItem) => {
      selectHook(file);
    };

    return (
      <React.Fragment>
        {
          files.map((file: IFileTreeItemRendered, index: number) => {
            if (file.filestat.isDirectory) {
              return <FileTreeDirNode
                file={file} index={file.index || index}
                selectHook={selectHandler}
                selected={file.selected}
                expanded={file.expanded}
                key={file.index}
              />;
            } else {
              return <FileTreeFileNode
              file={file} index={file.index || index}
              selectHook={selectHandler}
              selected={file.selected}
              key={file.index}
              />;
            }
          })
        }
      </React.Fragment>
    );
});

const FileTreeDirNode = observer((
    {file, index, expanded, selected, selectHook}:
    {file: IFileTreeItemRendered, index: number, expanded?: boolean, selected?: boolean, selectHook: any},
  ) => {
  const FileTreeNodeWrapperStyle = {
    position: 'absolute',
    width: '100%',
    height: '22px',
    left: '0',
    top: `${index * 22}px`,
  } as React.CSSProperties;
  const FileTreeNodeStyle = {
    paddingLeft: `${file.indent * 8}px`,
  } as React.CSSProperties;

  const treeItemStore = useInjectable(TreeItemStore);

  React.useEffect(() => {
    treeItemStore.parse(file.uri);
  }, [file.uri]);

  const selectHandler = () => {
    selectHook(file, expanded);
  };

  const handleClickThrottled = throttle(selectHandler, 200);

  return (
    <div style={ FileTreeNodeWrapperStyle } key={ file.id }>
      <div
        className={
        `${styles.kt_filetree_treenode} ${selected ? styles.kt_mod_selected : ''}`
        }
        style={ FileTreeNodeStyle }
        onClick={ handleClickThrottled }
      >
        <div className={ styles.kt_filetree_treenode_content }>
          <div
            className={
              `${styles.kt_filetree_treenode_segment}
               ${styles.kt_filetree_expansion_toggle}
               ${expanded ? '' : styles.kt_filetree_mod_collapsed}`
            }
          >
          </div>
          <div className={ `${treeItemStore.icon} ${styles.kt_filetree_file_icon}` }></div>
          <div
            className={ `${styles.kt_filetree_treenode_segment} ${styles.kt_filetree_treenode_segment_grow}`}
          >
            { file.name }
          </div>
          <div className={ `${styles.kt_filetree_treenode_segment} ${styles.kt_filetree_treeNode_tail}`}>M</div>
        </div>
      </div>
    </div>
  );
});

const FileTreeFileNode = observer((
    {file, index, selected, selectHook}:
    {file: IFileTreeItemRendered, index: number, selected?: boolean, selectHook: any},
  ) => {
    const treeItemStore = useInjectable(TreeItemStore);

    React.useEffect(() => {
      treeItemStore.parse(file.uri);
    }, [file.uri]);

    const selectHandler = () => {
      selectHook(file);
    };

    const handleClickThrottled = throttle(selectHandler, 200);
    const FileTreeNodeWrapperStyle = {
      position: 'absolute',
      width: '100%',
      height: '22px',
      left: '0',
      top: `${index * 22}px`,
    } as React.CSSProperties;

    const FileTreeNodeStyle = {
      paddingLeft: `${18 + file.indent * 8}px`,
    } as React.CSSProperties;

    return (
      <div style={ FileTreeNodeWrapperStyle } key={ file.id }>
        <div
        className={ `${styles.kt_filetree_treenode} ${selected ? styles.kt_mod_selected : ''}` }
          style={ FileTreeNodeStyle }
          onClick={ handleClickThrottled }
        >
          <div className={ styles.kt_filetree_treenode_content }>
            <div className={ `${treeItemStore.icon} ${styles.kt_filetree_file_icon}` }></div>
            <div
              className={ `${styles.kt_filetree_treenode_segment} ${styles.kt_filetree_treenode_segment_grow}`}
            >
              { file.name }
            </div>
            <div className={ `${styles.kt_filetree_treenode_segment} ${styles.kt_filetree_treeNode_tail}`}>M</div>
          </div>
        </div>
      </div>
    );
});

const extractFileItemShouldBeRendered = (
    files: IFileTreeItem[],
    status: IFileTreeItemStatus,
    indent: number = 0,
  ): IFileTreeItemRendered[] => {
    let renderedFiles: IFileTreeItemRendered[] = [];
    files.forEach((file: IFileTreeItem) => {
      const isExpanded = status.isExpanded.indexOf(file.id) >= 0;
      const childrens = file.children;
      renderedFiles.push({
        ...file,
        indent,
        selected: file.id === status.isSelected,
        expanded: isExpanded,
      });
      if (isExpanded && childrens && childrens.length > 0) {
        renderedFiles = renderedFiles.concat(extractFileItemShouldBeRendered(file.children, status, indent + 1 ));
      }
    });
    return renderedFiles;
};
