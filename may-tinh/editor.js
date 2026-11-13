/* Bộ soạn biểu thức dạng cây (Math I/O & Line I/O) cho Máy tính Thầy Minh (ES5) */
(function (root) {
  'use strict';

  var CalcEditor = {};

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Khởi tạo đối tượng trạng thái của bộ soạn thảo
  CalcEditor.create = function (lineMode) {
    var rootList = [];
    return {
      root: rootList,
      cursor: { list: rootList, index: 0 },
      stack: [], // lưu đường dẫn [{ parentList, nodeIndex, node, slotIndex }]
      insertMode: false,
      lineMode: !!lineMode
    };
  };

  // Xóa trắng bộ soạn thảo
  CalcEditor.clear = function (ed) {
    ed.root = [];
    ed.cursor = { list: ed.root, index: 0 };
    ed.stack = [];
  };

  // Sao chép sâu cây biểu thức để lưu lịch sử
  function cloneList(list, parentMap) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n.type === 'tok') {
        out.push({ type: 'tok', text: n.text, evalText: n.evalText });
      } else {
        var newSlots = [];
        var clonedNode = { type: n.type, slots: newSlots };
        for (var s = 0; s < n.slots.length; s++) {
          var cs = cloneList(n.slots[s], parentMap);
          cs._parent = { list: out, nodeIndex: i, node: clonedNode, slotIndex: s };
          newSlots.push(cs);
        }
        out.push(clonedNode);
      }
    }
    return out;
  }

  CalcEditor.cloneState = function (ed) {
    var newEd = CalcEditor.create(ed.lineMode);
    newEd.root = cloneList(ed.root);
    newEd.cursor = { list: newEd.root, index: newEd.root.length };
    newEd.stack = [];
    return newEd;
  };

  CalcEditor.isEmpty = function (ed) {
    return ed.root.length === 0;
  };

  // Kiểm tra một nút có phải chữ số/chấm/biến đơn để tự hút vào tử phân số không
  function isSimpleAtomTok(node) {
    if (!node || node.type !== 'tok') return false;
    var t = node.text;
    return /^[0-9.πeiA-FxyzM]$/.test(t) || t === 'Ans' || t === 'PreAns';
  }

  // Chèn một token đơn (số, phép toán, hàm dạng chữ) tại vị trí con trỏ
  CalcEditor.insertToken = function (ed, displayText, evalStr) {
    if (evalStr === undefined) evalStr = displayText;
    var tok = { type: 'tok', text: displayText, evalText: evalStr };
    ed.cursor.list.splice(ed.cursor.index, 0, tok);
    ed.cursor.index++;
  };

  // Chèn chuỗi văn bản (ví dụ từ bàn phím hoặc postMessage)
  CalcEditor.insertTextString = function (ed, str) {
    str = String(str || '');
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (ch === '*') CalcEditor.insertToken(ed, '×', '*');
      else if (ch === '/') CalcEditor.insertToken(ed, '÷', '/'); // văn bản chèn từ ngoài: / là phép chia
      else if (ch === '-') CalcEditor.insertToken(ed, '−', '-');
      else CalcEditor.insertToken(ed, ch, ch);
    }
  };

  // Tạo và chèn mẫu toán học (phân số, căn, mũ, tích phân, tổng...)
  CalcEditor.insertTemplate = function (ed, tplType) {
    if (ed.lineMode) {
      // Ở chế độ Line I/O: chèn cú pháp văn bản một dòng
      if (tplType === 'frac' || tplType === 'mixed') {
        CalcEditor.insertToken(ed, '⌟', '⌟');
      } else if (tplType === 'sqrt') {
        CalcEditor.insertToken(ed, '√(', 'sqrt(');
      } else if (tplType === 'cbrt') {
        CalcEditor.insertToken(ed, '∛(', 'cbrt(');
      } else if (tplType === 'root') {
        CalcEditor.insertToken(ed, 'root(', 'root(');
      } else if (tplType === 'pow') {
        CalcEditor.insertToken(ed, '^(', '^(');
      } else if (tplType === 'pow10') {
        CalcEditor.insertToken(ed, '10^(', '10^(');
      } else if (tplType === 'powe') {
        CalcEditor.insertToken(ed, 'e^(', 'exp(');
      } else if (tplType === 'log2') {
        CalcEditor.insertToken(ed, 'log(', 'log(');
      } else if (tplType === 'abs') {
        CalcEditor.insertToken(ed, 'abs(', 'abs(');
      } else if (tplType === 'integ') {
        CalcEditor.insertToken(ed, 'integ(', 'integ(');
      } else if (tplType === 'deriv') {
        CalcEditor.insertToken(ed, 'deriv(', 'deriv(');
      } else if (tplType === 'sum') {
        CalcEditor.insertToken(ed, 'sum(', 'sum(');
      } else if (tplType === 'prod') {
        CalcEditor.insertToken(ed, 'prod(', 'prod(');
      } else if (tplType === 'recur') {
        CalcEditor.insertToken(ed, '(', '(');
      }
      return;
    }

    var slotCount = 1;
    if (tplType === 'frac' || tplType === 'root' || tplType === 'log2' || tplType === 'deriv') {
      slotCount = 2;
    } else if (tplType === 'mixed' || tplType === 'integ' || tplType === 'sum' || tplType === 'prod') {
      slotCount = 3;
    }

    var slots = [];
    for (var s = 0; s < slotCount; s++) {
      slots.push([]);
    }

    var curList = ed.cursor.list;
    var curIdx = ed.cursor.index;
    var absorbed = [];

    // Với phân số (hoặc khi bật INS): nếu ngay trước con trỏ là các chữ số/biến, hút vào tử số
    if (tplType === 'frac' || ed.insertMode) {
      var startAbsorb = curIdx;
      var prevTok = curList[curIdx - 1];
      if (prevTok && prevTok.type === 'tok' && prevTok.text === ')') {
        // Ngay trước là ")": hút cả cụm trong ngoặc (kể cả tên hàm như "sin(") vào tử số
        var depth = 0;
        for (var j = curIdx - 1; j >= 0; j--) {
          var tj = curList[j];
          if (!tj || tj.type !== 'tok') continue;
          if (tj.text === ')') depth++;
          else if (tj.text.charAt(tj.text.length - 1) === '(') {
            depth--;
            if (depth === 0) { startAbsorb = j; break; }
          }
        }
      } else {
        while (startAbsorb > 0 && isSimpleAtomTok(curList[startAbsorb - 1])) {
          startAbsorb--;
        }
      }
      if (startAbsorb < curIdx) {
        absorbed = curList.splice(startAbsorb, curIdx - startAbsorb);
        curIdx = startAbsorb;
        ed.cursor.index = curIdx;
      }
    }

    var node = { type: tplType, slots: slots };
    if (absorbed.length > 0) {
      for (var a = 0; a < absorbed.length; a++) {
        slots[0].push(absorbed[a]);
      }
    }

    // Với tổng Σ và tích Π: mặc định cận dưới bắt đầu từ 1 nếu muốn, hoặc để trống cho người dùng nhập
    curList.splice(curIdx, 0, node);

    // Chọn ô đầu tiên để đặt con trỏ
    var targetSlot = 0;
    if (tplType === 'frac' && absorbed.length > 0) {
      targetSlot = 1; // Nếu đã hút tử số thì nhảy thẳng xuống mẫu số như máy thật!
    }

    ed.stack.push({
      parentList: curList,
      nodeIndex: curIdx,
      node: node,
      slotIndex: targetSlot
    });
    ed.cursor = {
      list: slots[targetSlot],
      index: slots[targetSlot].length
    };
  };

  // Cập nhật lại nodeIndex trong stack nếu danh sách cha thay đổi
  function findNodeIndex(list, node) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] === node) return i;
    }
    return 0;
  }

  // Di chuyển con trỏ sang trái (◀)
  CalcEditor.moveLeft = function (ed) {
    if (ed.cursor.index > 0) {
      var prevNode = ed.cursor.list[ed.cursor.index - 1];
      if (prevNode.type === 'tok') {
        ed.cursor.index--;
        return;
      }
      // Đi vào ô cuối cùng của mẫu phía trước
      var lastSlot = prevNode.slots.length - 1;
      ed.stack.push({
        parentList: ed.cursor.list,
        nodeIndex: ed.cursor.index - 1,
        node: prevNode,
        slotIndex: lastSlot
      });
      ed.cursor = {
        list: prevNode.slots[lastSlot],
        index: prevNode.slots[lastSlot].length
      };
      return;
    }

    // Đang ở đầu một ô của mẫu
    if (ed.stack.length > 0) {
      var top = ed.stack[ed.stack.length - 1];
      if (top.slotIndex > 0) {
        top.slotIndex--;
        var prevSlotList = top.node.slots[top.slotIndex];
        ed.cursor = {
          list: prevSlotList,
          index: prevSlotList.length
        };
      } else {
        // Thoát ra đứng trước mẫu
        ed.stack.pop();
        var idx = findNodeIndex(top.parentList, top.node);
        ed.cursor = {
          list: top.parentList,
          index: idx
        };
      }
      return;
    }

    // Nếu ở đầu ngoài cùng: vòng về cuối biểu thức như máy tính
    if (ed.root.length > 0) {
      ed.cursor = { list: ed.root, index: ed.root.length };
      ed.stack = [];
    }
  };

  // Di chuyển con trỏ sang phải (▶)
  CalcEditor.moveRight = function (ed) {
    if (ed.cursor.index < ed.cursor.list.length) {
      var nextNode = ed.cursor.list[ed.cursor.index];
      if (nextNode.type === 'tok') {
        ed.cursor.index++;
        return;
      }
      // Đi vào ô đầu tiên của mẫu phía sau
      ed.stack.push({
        parentList: ed.cursor.list,
        nodeIndex: ed.cursor.index,
        node: nextNode,
        slotIndex: 0
      });
      ed.cursor = {
        list: nextNode.slots[0],
        index: 0
      };
      return;
    }

    // Đang ở cuối một ô của mẫu
    if (ed.stack.length > 0) {
      var top = ed.stack[ed.stack.length - 1];
      if (top.slotIndex < top.node.slots.length - 1) {
        top.slotIndex++;
        var nextSlotList = top.node.slots[top.slotIndex];
        ed.cursor = {
          list: nextSlotList,
          index: 0
        };
      } else {
        // Thoát ra đứng sau mẫu
        ed.stack.pop();
        var idx = findNodeIndex(top.parentList, top.node);
        ed.cursor = {
          list: top.parentList,
          index: idx + 1
        };
      }
      return;
    }

    // Nếu ở cuối ngoài cùng: vòng về đầu biểu thức
    if (ed.root.length > 0) {
      ed.cursor = { list: ed.root, index: 0 };
      ed.stack = [];
    }
  };

  // Di chuyển lên (▲) giữa các ô của mẫu (mẫu -> tử, cận dưới -> cận trên...)
  CalcEditor.moveUp = function (ed) {
    for (var i = ed.stack.length - 1; i >= 0; i--) {
      var frame = ed.stack[i];
      var t = frame.node.type;
      if (t === 'frac' && frame.slotIndex === 1) {
        ed.stack = ed.stack.slice(0, i + 1);
        frame.slotIndex = 0;
        ed.cursor = { list: frame.node.slots[0], index: frame.node.slots[0].length };
        return true;
      }
      if (t === 'mixed' && frame.slotIndex === 2) {
        ed.stack = ed.stack.slice(0, i + 1);
        frame.slotIndex = 1;
        ed.cursor = { list: frame.node.slots[1], index: frame.node.slots[1].length };
        return true;
      }
      if ((t === 'integ' || t === 'sum' || t === 'prod') && frame.slotIndex === 1) {
        ed.stack = ed.stack.slice(0, i + 1);
        frame.slotIndex = 2;
        ed.cursor = { list: frame.node.slots[2], index: frame.node.slots[2].length };
        return true;
      }
      if ((t === 'integ' || t === 'sum' || t === 'prod') && frame.slotIndex === 0) {
        ed.stack = ed.stack.slice(0, i + 1);
        frame.slotIndex = 2;
        ed.cursor = { list: frame.node.slots[2], index: frame.node.slots[2].length };
        return true;
      }
    }
    return false;
  };

  // Di chuyển xuống (▼) giữa các ô của mẫu (tử -> mẫu, cận trên -> cận dưới...)
  CalcEditor.moveDown = function (ed) {
    for (var i = ed.stack.length - 1; i >= 0; i--) {
      var frame = ed.stack[i];
      var t = frame.node.type;
      if (t === 'frac' && frame.slotIndex === 0) {
        ed.stack = ed.stack.slice(0, i + 1);
        frame.slotIndex = 1;
        ed.cursor = { list: frame.node.slots[1], index: frame.node.slots[1].length };
        return true;
      }
      if (t === 'mixed' && (frame.slotIndex === 0 || frame.slotIndex === 1)) {
        ed.stack = ed.stack.slice(0, i + 1);
        frame.slotIndex = 2;
        ed.cursor = { list: frame.node.slots[2], index: frame.node.slots[2].length };
        return true;
      }
      if ((t === 'integ' || t === 'sum' || t === 'prod') && frame.slotIndex === 2) {
        ed.stack = ed.stack.slice(0, i + 1);
        frame.slotIndex = 1;
        ed.cursor = { list: frame.node.slots[1], index: frame.node.slots[1].length };
        return true;
      }
      if ((t === 'integ' || t === 'sum' || t === 'prod') && frame.slotIndex === 0) {
        ed.stack = ed.stack.slice(0, i + 1);
        frame.slotIndex = 1;
        ed.cursor = { list: frame.node.slots[1], index: frame.node.slots[1].length };
        return true;
      }
    }
    return false;
  };

  function isTemplateEmpty(node) {
    if (!node || !node.slots) return true;
    for (var i = 0; i < node.slots.length; i++) {
      if (node.slots[i].length > 0) return false;
    }
    return true;
  }

  // Xóa ký tự hoặc mẫu trước con trỏ (DEL)
  CalcEditor.deleteBack = function (ed) {
    if (ed.cursor.index > 0) {
      var prev = ed.cursor.list[ed.cursor.index - 1];
      if (prev.type === 'tok') {
        ed.cursor.list.splice(ed.cursor.index - 1, 1);
        ed.cursor.index--;
        return;
      }
      // Nếu là mẫu rỗng: xóa luôn mẫu
      if (isTemplateEmpty(prev)) {
        ed.cursor.list.splice(ed.cursor.index - 1, 1);
        ed.cursor.index--;
        return;
      }
      // Nếu mẫu không rỗng: nhảy vào cuối ô cuối của mẫu
      var lastSlot = prev.slots.length - 1;
      ed.stack.push({
        parentList: ed.cursor.list,
        nodeIndex: ed.cursor.index - 1,
        node: prev,
        slotIndex: lastSlot
      });
      ed.cursor = {
        list: prev.slots[lastSlot],
        index: prev.slots[lastSlot].length
      };
      return;
    }

    // Đang ở đầu một ô của mẫu
    if (ed.stack.length > 0) {
      var top = ed.stack[ed.stack.length - 1];
      var node = top.node;
      var pList = top.parentList;
      var nIdx = findNodeIndex(pList, node);

      if (isTemplateEmpty(node)) {
        ed.stack.pop();
        pList.splice(nIdx, 1);
        ed.cursor = { list: pList, index: nIdx };
        return;
      }

      // Nếu đang ở mẫu số của phân số mà mẫu số rỗng, còn tử số có nội dung -> giải phóng tử số ra ngoài
      if (node.type === 'frac' && top.slotIndex === 1 && node.slots[1].length === 0) {
        var numItems = node.slots[0];
        ed.stack.pop();
        var args = [nIdx, 1].concat(numItems);
        Array.prototype.splice.apply(pList, args);
        ed.cursor = { list: pList, index: nIdx + numItems.length };
        return;
      }

      // Nếu ở ô đầu của căn/mũ/trị tuyệt đối mà muốn xóa vỏ mẫu, giữ lại ruột
      if (top.slotIndex === 0 && node.slots.length === 1) {
        var innerItems = node.slots[0];
        ed.stack.pop();
        var args1 = [nIdx, 1].concat(innerItems);
        Array.prototype.splice.apply(pList, args1);
        ed.cursor = { list: pList, index: nIdx };
        return;
      }

      // Còn lại: lùi về ô trước đó
      CalcEditor.moveLeft(ed);
    }
  };

  // Chuyển danh sách nút thành chuỗi văn bản cho CalcEngine.evalText
  function listToEvalText(list) {
    if (!list || list.length === 0) return '';
    var parts = [];
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n.type === 'tok') {
        parts.push(n.evalText !== undefined ? n.evalText : n.text);
      } else if (n.type === 'frac') {
        parts.push('frac((' + listToEvalText(n.slots[0]) + '),(' + listToEvalText(n.slots[1]) + '))');
      } else if (n.type === 'mixed') {
        parts.push('mixed((' + listToEvalText(n.slots[0]) + '),(' + listToEvalText(n.slots[1]) + '),(' + listToEvalText(n.slots[2]) + '))');
      } else if (n.type === 'sqrt') {
        parts.push('sqrt(' + listToEvalText(n.slots[0]) + ')');
      } else if (n.type === 'cbrt') {
        parts.push('cbrt(' + listToEvalText(n.slots[0]) + ')');
      } else if (n.type === 'root') {
        parts.push('root((' + listToEvalText(n.slots[0]) + '),(' + listToEvalText(n.slots[1]) + '))');
      } else if (n.type === 'pow') {
        parts.push('^(' + listToEvalText(n.slots[0]) + ')');
      } else if (n.type === 'pow10') {
        parts.push('(10^(' + listToEvalText(n.slots[0]) + '))');
      } else if (n.type === 'powe') {
        parts.push('exp(' + listToEvalText(n.slots[0]) + ')');
      } else if (n.type === 'log2') {
        parts.push('log((' + listToEvalText(n.slots[0]) + '),(' + listToEvalText(n.slots[1]) + '))');
      } else if (n.type === 'abs') {
        parts.push('abs(' + listToEvalText(n.slots[0]) + ')');
      } else if (n.type === 'integ') {
        parts.push('integ(' + listToEvalText(n.slots[0]) + ',' + listToEvalText(n.slots[1]) + ',' + listToEvalText(n.slots[2]) + ')');
      } else if (n.type === 'deriv') {
        parts.push('deriv(' + listToEvalText(n.slots[0]) + ',' + listToEvalText(n.slots[1]) + ')');
      } else if (n.type === 'sum') {
        parts.push('sum(' + listToEvalText(n.slots[0]) + ',' + listToEvalText(n.slots[1]) + ',' + listToEvalText(n.slots[2]) + ')');
      } else if (n.type === 'prod') {
        parts.push('prod(' + listToEvalText(n.slots[0]) + ',' + listToEvalText(n.slots[1]) + ',' + listToEvalText(n.slots[2]) + ')');
      } else if (n.type === 'recur') {
        var prevStr = parts.join('');
        var recInner = listToEvalText(n.slots[0]);
        if (/\d*\.\d*$/.test(prevStr)) {
          parts.push('(' + recInner + ')');
        } else if (/\d+$/.test(prevStr)) {
          parts.push('.(' + recInner + ')');
        } else {
          parts.push('0.(' + recInner + ')');
        }
      }
    }
    return parts.join('');
  }

  CalcEditor.toEvalText = function (ed) {
    return listToEvalText(ed.root);
  };

  // Kiểm tra danh sách có chứa biến nào (dùng cho phím CALC)
  CalcEditor.findVariables = function (ed) {
    var text = CalcEditor.toEvalText(ed);
    var found = [];
    var candidates = ['x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'M'];
    // Loại bỏ x nếu x chỉ nằm trong integ/deriv/sum/prod? Vẫn có thể hỏi các biến có mặt
    for (var i = 0; i < candidates.length; i++) {
      var v = candidates[i];
      var re = new RegExp('(^|[^a-zA-Z])' + v + '([^a-zA-Z]|$)');
      if (re.test(text)) {
        found.push(v);
      }
    }
    return found;
  };

  // Vẽ cây biểu thức ra HTML tự nhiên (sách giáo khoa)
  CalcEditor.renderHTML = function (ed, showCursor) {
    var cursorHtml = '<span class="m-cursor' + (ed.insertMode ? ' m-cursor-ins' : '') + '"></span>';

    function renderSlot(slotList) {
      var isCurList = showCursor && (ed.cursor.list === slotList);
      if (slotList.length === 0) {
        if (isCurList) {
          return '<span class="m-empty m-empty-active">' + cursorHtml + '</span>';
        }
        return '<span class="m-empty"></span>';
      }
      return renderList(slotList);
    }

    function renderList(list) {
      var html = '';
      var isCur = showCursor && (ed.cursor.list === list);
      for (var i = 0; i <= list.length; i++) {
        if (isCur && ed.cursor.index === i) {
          html += cursorHtml;
        }
        if (i < list.length) {
          html += renderNode(list[i]);
        }
      }
      return html;
    }

    function renderNode(n) {
      if (n.type === 'tok') {
        return '<span class="m-tok">' + escapeHtml(n.text) + '</span>';
      }
      if (n.type === 'frac') {
        return (
          '<span class="m-frac">' +
            '<span class="m-num">' + renderSlot(n.slots[0]) + '</span>' +
            '<span class="m-bar"></span>' +
            '<span class="m-den">' + renderSlot(n.slots[1]) + '</span>' +
          '</span>'
        );
      }
      if (n.type === 'mixed') {
        return (
          '<span class="m-mixed">' +
            '<span class="m-whole">' + renderSlot(n.slots[0]) + '</span>' +
            '<span class="m-frac">' +
              '<span class="m-num">' + renderSlot(n.slots[1]) + '</span>' +
              '<span class="m-bar"></span>' +
              '<span class="m-den">' + renderSlot(n.slots[2]) + '</span>' +
            '</span>' +
          '</span>'
        );
      }
      if (n.type === 'sqrt') {
        return (
          '<span class="m-sqrt">' +
            '<span class="m-rad-sym">√</span>' +
            '<span class="m-rad-body">' + renderSlot(n.slots[0]) + '</span>' +
          '</span>'
        );
      }
      if (n.type === 'cbrt') {
        return (
          '<span class="m-root">' +
            '<span class="m-root-idx">3</span>' +
            '<span class="m-sqrt">' +
              '<span class="m-rad-sym">√</span>' +
              '<span class="m-rad-body">' + renderSlot(n.slots[0]) + '</span>' +
            '</span>' +
          '</span>'
        );
      }
      if (n.type === 'root') {
        return (
          '<span class="m-root">' +
            '<span class="m-root-idx">' + renderSlot(n.slots[0]) + '</span>' +
            '<span class="m-sqrt">' +
              '<span class="m-rad-sym">√</span>' +
              '<span class="m-rad-body">' + renderSlot(n.slots[1]) + '</span>' +
            '</span>' +
          '</span>'
        );
      }
      if (n.type === 'pow') {
        return '<span class="m-sup">' + renderSlot(n.slots[0]) + '</span>';
      }
      if (n.type === 'pow10') {
        return '<span class="m-tok">10</span><span class="m-sup">' + renderSlot(n.slots[0]) + '</span>';
      }
      if (n.type === 'powe') {
        return '<span class="m-tok"><i>e</i></span><span class="m-sup">' + renderSlot(n.slots[0]) + '</span>';
      }
      if (n.type === 'log2') {
        return (
          '<span class="m-log">' +
            '<span class="m-tok">log</span>' +
            '<span class="m-sub">' + renderSlot(n.slots[0]) + '</span>' +
            '<span class="m-tok">(</span>' +
            renderSlot(n.slots[1]) +
            '<span class="m-tok">)</span>' +
          '</span>'
        );
      }
      if (n.type === 'abs') {
        return (
          '<span class="m-abs">' +
            '<span class="m-abs-bar">|</span>' +
            '<span class="m-abs-body">' + renderSlot(n.slots[0]) + '</span>' +
            '<span class="m-abs-bar">|</span>' +
          '</span>'
        );
      }
      if (n.type === 'integ') {
        return (
          '<span class="m-bigop">' +
            '<span class="m-bigop-col">' +
              '<span class="m-bigop-up">' + renderSlot(n.slots[2]) + '</span>' +
              '<span class="m-bigop-sym">∫</span>' +
              '<span class="m-bigop-low">' + renderSlot(n.slots[1]) + '</span>' +
            '</span>' +
            '<span class="m-bigop-expr">(' + renderSlot(n.slots[0]) + ')d<i>x</i></span>' +
          '</span>'
        );
      }
      if (n.type === 'deriv') {
        return (
          '<span class="m-deriv">' +
            '<span class="m-frac m-frac-sm">' +
              '<span class="m-num">d</span>' +
              '<span class="m-bar"></span>' +
              '<span class="m-den">d<i>x</i></span>' +
            '</span>' +
            '<span class="m-tok">(</span>' + renderSlot(n.slots[0]) + '<span class="m-tok">)</span>' +
            '<span class="m-deriv-at">|<sub><i>x</i>=' + renderSlot(n.slots[1]) + '</sub></span>' +
          '</span>'
        );
      }
      if (n.type === 'sum' || n.type === 'prod') {
        var sym = n.type === 'sum' ? '∑' : '∏';
        return (
          '<span class="m-bigop">' +
            '<span class="m-bigop-col">' +
              '<span class="m-bigop-up">' + renderSlot(n.slots[2]) + '</span>' +
              '<span class="m-bigop-sym">' + sym + '</span>' +
              '<span class="m-bigop-low"><i>x</i>=' + renderSlot(n.slots[1]) + '</span>' +
            '</span>' +
            '<span class="m-bigop-expr">(' + renderSlot(n.slots[0]) + ')</span>' +
          '</span>'
        );
      }
      if (n.type === 'recur') {
        return '<span class="m-recur"><span class="m-recur-body">' + renderSlot(n.slots[0]) + '</span></span>';
      }
      return '';
    }

    if (ed.root.length === 0) {
      return showCursor ? cursorHtml : '';
    }
    return renderList(ed.root);
  };

  // Vẽ chuỗi kết quả chính xác (ví dụ "5/6", "2√3/5", "-1/2+√3/2 i", "1 1/2", "2^3×3^2×5") thành HTML tự nhiên
  function formatTermNatural(term) {
    // Thay √(\d+) bằng căn có gạch trên đầu
    return escapeHtml(term).replace(/√([0-9]+)/g, '<span class="m-sqrt"><span class="m-rad-sym">√</span><span class="m-rad-body">$1</span></span>')
      .replace(/\^([\-0-9]+)/g, '<span class="m-sup">$1</span>');
  }

  function formatSingleFracOrTerm(str) {
    str = str.replace(/^\s+|\s+$/g, '');
    // Kiểm tra hậu tố i (số phức)
    var hasI = false;
    if (/\s*i$/.test(str) && str.indexOf('q=') === -1) {
      hasI = true;
      str = str.replace(/\s*i$/, '');
      if (str === '' || str === '+') str = '1';
      else if (str === '-') str = '-1';
    }

    // Hỗn số "1 1/2" hoặc "-1 1/2"
    var mixMatch = str.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
    if (mixMatch) {
      var mHtml =
        '<span class="m-mixed">' +
          '<span class="m-whole">' + escapeHtml(mixMatch[1]) + '</span>' +
          '<span class="m-frac">' +
            '<span class="m-num">' + escapeHtml(mixMatch[2]) + '</span>' +
            '<span class="m-bar"></span>' +
            '<span class="m-den">' + escapeHtml(mixMatch[3]) + '</span>' +
          '</span>' +
        '</span>';
      return mHtml + (hasI ? '<span class="m-tok"><i>i</i></span>' : '');
    }

    // Phân số có dạng A/B
    var slashIdx = str.indexOf('/');
    if (slashIdx !== -1) {
      var num = str.slice(0, slashIdx);
      var den = str.slice(slashIdx + 1);
      var sign = '';
      if (num.charAt(0) === '-') {
        sign = '−';
        num = num.slice(1);
      } else if (num.charAt(0) === '+') {
        sign = '+';
        num = num.slice(1);
      }
      return (
        (sign ? '<span class="m-tok">' + sign + '</span>' : '') +
        '<span class="m-frac">' +
          '<span class="m-num">' + formatTermNatural(num) + '</span>' +
          '<span class="m-bar"></span>' +
          '<span class="m-den">' + formatTermNatural(den) + '</span>' +
        '</span>' +
        (hasI ? '<span class="m-tok"><i>i</i></span>' : '')
      );
    }

    var resHtml = formatTermNatural(str.replace(/-/g, '−'));
    if (hasI) {
      if (resHtml === '1') resHtml = '<i>i</i>';
      else if (resHtml === '−1') resHtml = '−<i>i</i>';
      else resHtml += '<i>i</i>';
    }
    return resHtml;
  }

  CalcEditor.renderResultHTML = function (str, lineMode) {
    if (!str) return '';
    str = String(str);
    if (lineMode) {
      return escapeHtml(str).replace(/\^([\-0-9]+)/g, '<span class="m-sup">$1</span>');
    }

    // Nếu là số thập phân tuần hoàn dạng 0.(3) hoặc -1.2(34)
    var recResMatch = str.match(/^(-?\d+\.\d*)\((\d+)\)$/);
    if (recResMatch) {
      var preRec = escapeHtml(recResMatch[1].replace(/-/g, '−'));
      var bodyRec = escapeHtml(recResMatch[2]);
      return '<span class="m-tok">' + preRec + '</span><span class="m-recur"><span class="m-recur-body">' + bodyRec + '</span></span>';
    }

    // Nếu là dạng khoa học 1.23×10^-5
    if (str.indexOf('×10^') !== -1) {
      return escapeHtml(str).replace(/×10\^([\-0-9]+)/g, '×10<span class="m-sup">$1</span>');
    }

    // Nếu là dạng cực số phức r∠θ
    var angIdx = str.indexOf('∠');
    if (angIdx !== -1) {
      var rPart = str.slice(0, angIdx);
      var thPart = str.slice(angIdx + 1);
      return formatSingleFracOrTerm(rPart) + '<span class="m-tok">∠</span>' + formatSingleFracOrTerm(thPart);
    }

    // Nếu là tổng/hiệu 2 hạng tử (ví dụ "-1/2+√3/2 i" hoặc "1/2-√5/2")
    var splitPos = -1;
    for (var i = 1; i < str.length; i++) {
      var ch = str.charAt(i);
      if ((ch === '+' || ch === '-') && str.charAt(i - 1) !== '^' && str.charAt(i - 1) !== 'E') {
        splitPos = i;
        break;
      }
    }
    if (splitPos !== -1 && str.indexOf('q=') === -1) {
      var firstTerm = str.slice(0, splitPos);
      var opChar = str.charAt(splitPos) === '-' ? '−' : '+';
      var secondTerm = str.slice(splitPos + 1);
      return formatSingleFracOrTerm(firstTerm) + '<span class="m-tok">' + opChar + '</span>' + formatSingleFracOrTerm(secondTerm);
    }

    return formatSingleFracOrTerm(str);
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalcEditor;
  } else {
    root.CalcEditor = CalcEditor;
  }
})(this);
