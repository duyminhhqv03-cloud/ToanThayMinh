/* Lõi toán học thuần cho Máy tính Thầy Minh (ES5) */
(function (root) {
  'use strict';

  var CalcEngine = {};
  var EPS = 1e-12;

  function isNum(x) {
    return typeof x === 'number' && !isNaN(x) && isFinite(x);
  }

  function gcdInt(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    if (a === 0 && b === 0) return 0;
    while (b !== 0) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  function lcmInt(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    if (a === 0 || b === 0) return 0;
    return (a / gcdInt(a, b)) * b;
  }

  // Tách phần chính phương khỏi n: n = s^2 * r (r square-free)
  function splitSquare(n) {
    n = Math.round(n);
    var s = 1;
    var r = n;
    var d = 2;
    while (d * d <= r) {
      while (r % (d * d) === 0) {
        s *= d;
        r = Math.round(r / (d * d));
      }
      d = d === 2 ? 3 : d + 2;
    }
    return { s: s, r: r };
  }

  // Tìm phân số p/q xấp xỉ x bằng liên phân số với q <= maxQ
  function findFraction(x, maxQ, relTol) {
    if (!isNum(x)) return null;
    maxQ = maxQ || 10000;
    relTol = relTol || 1e-12;
    var sign = x < 0 ? -1 : 1;
    var ax = Math.abs(x);
    if (ax < 1e-15) return { p: 0, q: 1 };
    var h1 = 1, h2 = 0;
    var k1 = 0, k2 = 1;
    var b = ax;
    for (var i = 0; i < 40; i++) {
      var a = Math.floor(b + 1e-13);
      var h = a * h1 + h2;
      var k = a * k1 + k2;
      if (k > maxQ) break;
      h2 = h1; h1 = h;
      k2 = k1; k1 = k;
      var approx = h1 / k1;
      var err = Math.abs(ax - approx);
      if (err <= relTol * Math.max(1, ax)) {
        var g = gcdInt(h1, k1);
        return { p: sign * Math.round(h1 / g), q: Math.round(k1 / g) };
      }
      var rem = b - a;
      if (Math.abs(rem) < 1e-14) break;
      b = 1 / rem;
      if (!isFinite(b) || b > 1e14) break;
    }
    if (k1 > 0 && k1 <= maxQ) {
      var err2 = Math.abs(ax - h1 / k1);
      if (err2 <= relTol * Math.max(1, ax)) {
        var g2 = gcdInt(h1, k1);
        return { p: sign * Math.round(h1 / g2), q: Math.round(k1 / g2) };
      }
    }
    return null;
  }

  // Kiểm tra số thập phân tuần hoàn từ phân số p/q (|p/q| < 1e6, q <= 1000)
  CalcEngine.toRecurring = function (value) {
    if (!isNum(value)) return null;
    var frac = findFraction(value, 999, 1e-12);
    if (!frac || frac.q <= 1) return null;
    var q = frac.q;
    var qRed = q;
    while (qRed % 2 === 0) qRed /= 2;
    while (qRed % 5 === 0) qRed /= 5;
    if (qRed === 1) return null; // thập phân hữu hạn
    var sign = frac.p < 0 ? '-' : '';
    var p = Math.abs(frac.p);
    var intPart = Math.floor(p / q);
    var rem = p % q;
    var seen = {};
    var digits = [];
    var pos = 0;
    while (rem !== 0 && seen[rem] === undefined && pos < 100) {
      seen[rem] = pos;
      rem *= 10;
      digits.push(Math.floor(rem / q));
      rem = rem % q;
      pos++;
    }
    if (rem === 0 || seen[rem] === undefined) return null;
    var start = seen[rem];
    var nonRep = digits.slice(0, start).join('');
    var rep = digits.slice(start).join('');
    if (rep.length > 24) return null;
    return sign + intPart + '.' + nonRep + '(' + rep + ')';
  };

  function formatSqrtTerm(a, b, c) {
    // Biểu diễn (a * sqrt(b)) / c với a != 0, b > 1 square-free, c >= 1, gcd(|a|, c) = 1
    var g = gcdInt(Math.abs(a), c);
    a = Math.round(a / g);
    c = Math.round(c / g);
    var sign = a < 0 ? '-' : '';
    var aa = Math.abs(a);
    var num = (aa === 1 ? '' : String(aa)) + '√' + String(b);
    if (c === 1) return sign + num;
    return sign + num + '/' + String(c);
  }

  // Nhận dạng dạng chính xác của số thực value
  CalcEngine.toExact = function (value) {
    if (!isNum(value)) return null;
    if (Math.abs(value) < 1e-13) return '0';

    // 1. Số nguyên (|v| < 1e10)
    if (Math.abs(value) < 1e10) {
      var rInt = Math.round(value);
      if (Math.abs(value - rInt) <= 1e-11 * Math.max(1, Math.abs(value))) {
        return String(rInt);
      }
    }

    // 2. Phân số p/q với q <= 10000
    var frac = findFraction(value, 10000, 1e-12);
    if (frac) {
      if (frac.q === 1) return String(frac.p);
      return frac.p + '/' + frac.q;
    }

    // 3a. Dạng căn thuần (a*sqrt(b))/c với b <= 1000, c <= 100
    // Ta thấy value^2 = (a^2 * b) / c^2 là số hữu tỉ!
    var v2 = value * value;
    var frac2 = findFraction(v2, 10000, 1e-11);
    if (frac2 && frac2.p > 0) {
      // value^2 = P / Q -> |value| = sqrt(P * Q) / Q
      // Tách chính phương khỏi P và Q: P = sP^2 * rP, Q = sQ^2 * rQ
      // |value| = (sP * sqrt(rP * rQ)) / (sQ * rQ)
      var spP = splitSquare(frac2.p);
      var spQ = splitSquare(frac2.q);
      var bRad = spP.r * spQ.r;
      var aCoef = spP.s;
      var cDen = spQ.s * spQ.r;
      var g0 = gcdInt(aCoef, cDen);
      aCoef = Math.round(aCoef / g0);
      cDen = Math.round(cDen / g0);
      if (bRad > 1 && bRad <= 1000 && cDen <= 100 && aCoef <= 1000) {
        var signedA = value < 0 ? -aCoef : aCoef;
        var approxRad = (signedA * Math.sqrt(bRad)) / cDen;
        if (Math.abs(value - approxRad) <= 1e-11 * Math.max(1, Math.abs(value))) {
          return formatSqrtTerm(signedA, bRad, cDen);
        }
      }
    }

    // 4. Bội của pi: k*pi/c (|k| <= 200, c <= 120)
    var overPi = value / Math.PI;
    var fracPi = findFraction(overPi, 120, 1e-11);
    if (fracPi && fracPi.p !== 0 && Math.abs(fracPi.p) <= 240 && fracPi.q <= 120) {
      var kp = fracPi.p;
      var cq = fracPi.q;
      var sgn = kp < 0 ? '-' : '';
      var akp = Math.abs(kp);
      var numPi = (akp === 1 ? '' : String(akp)) + 'π';
      return cq === 1 ? sgn + numPi : sgn + numPi + '/' + String(cq);
    }

    // 3b. Dạng p/q ± a*sqrt(b)/c (dạng nghiệm phương trình bậc hai) với mẫu c <= 100, b <= 1000
    // Nhận xét: nếu x = (p + a*sqrt(b)) / c thì (c*x - p)^2 = a^2 * b là số nguyên dương M!
    for (var c = 1; c <= 100; c++) {
      var cx = c * value;
      for (var p = -100; p <= 100; p++) {
        if (p === 0) continue;
        var diff = cx - p;
        var d2 = diff * diff;
        var M = Math.round(d2);
        if (M <= 1 || M > 100000) continue;
        if (Math.abs(d2 - M) <= 1e-9 * Math.max(1, M)) {
          var spM = splitSquare(M);
          var bVal = spM.r;
          var aAbs = spM.s;
          if (bVal > 1 && bVal <= 1000) {
            var aSigned = diff < 0 ? -aAbs : aAbs;
            var testVal = (p + aSigned * Math.sqrt(bVal)) / c;
            if (Math.abs(value - testVal) <= 1e-11 * Math.max(1, Math.abs(value))) {
              var g1 = gcdInt(Math.abs(p), c);
              var p1 = Math.round(p / g1);
              var q1 = Math.round(c / g1);
              var part1 = q1 === 1 ? String(p1) : (p1 + '/' + q1);
              var part2 = formatSqrtTerm(aSigned, bVal, c);
              if (part2.charAt(0) === '-') {
                return part1 + part2;
              }
              return part1 + '+' + part2;
            }
          }
        }
      }
    }

    return null;
  };

  // Định dạng số thập phân kiểu máy tính
  CalcEngine.format = function (value, fmt) {
    if (!isNum(value)) return 'Lỗi';
    fmt = fmt || {};
    var mode = fmt.mode || 'norm1';
    var digits = typeof fmt.digits === 'number' ? fmt.digits : 0;

    if (Math.abs(value) < 1e-99) value = 0;
    if (value === 0) {
      if (mode === 'fix' && digits > 0) {
        var z = '0.';
        for (var i = 0; i < digits; i++) z += '0';
        return z;
      }
      if (mode === 'sci') {
        var zs = '0';
        var dSci = digits > 0 ? digits : 1;
        if (dSci > 1) {
          zs += '.';
          for (var j = 1; j < dSci; j++) zs += '0';
        }
        return zs + '×10^0';
      }
      return '0';
    }

    var sign = value < 0 ? '-' : '';
    var av = Math.abs(value);

    if (mode === 'fix') {
      var dFix = Math.max(0, Math.min(9, digits));
      if (av >= 1e10) {
        return formatSci(sign, av, 10, false);
      }
      var factor = Math.pow(10, dFix);
      var rounded = Math.round(av * factor + 1e-12) / factor;
      return (rounded === 0 ? '' : sign) + rounded.toFixed(dFix);
    }

    if (mode === 'sci') {
      var dS = digits >= 1 && digits <= 10 ? digits : 10;
      return formatSci(sign, av, dS, true);
    }

    // norm1 hoặc norm2
    var lowThresh = mode === 'norm2' ? 1e-9 : 0.01;
    // Làm tròn 10 chữ số có nghĩa trước khi kiểm tra ngưỡng
    var exp10 = Math.floor(Math.log(av) / Math.LN10 + 1e-12);
    var mant = av / Math.pow(10, exp10);
    mant = Math.round(mant * 1e9) / 1e9;
    if (mant >= 10) {
      mant /= 10;
      exp10 += 1;
    }
    var normVal = mant * Math.pow(10, exp10);

    if (normVal < lowThresh || normVal >= 1e10) {
      var mStr = trimTrailingZeros(mant.toFixed(9));
      return sign + mStr + '×10^' + exp10;
    }

    // Hiển thị dạng thường với tối đa 10 chữ số có nghĩa
    var decPlaces = Math.max(0, 9 - exp10);
    var sNorm = normVal.toFixed(Math.min(12, decPlaces));
    sNorm = trimTrailingZeros(sNorm);
    return sign + sNorm;
  };

  function trimTrailingZeros(s) {
    if (s.indexOf('.') === -1) return s;
    s = s.replace(/0+$/, '');
    if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    return s;
  }

  function formatSci(sign, av, sigDigits, keepZeros) {
    var exp = Math.floor(Math.log(av) / Math.LN10 + 1e-12);
    var mant = av / Math.pow(10, exp);
    var dec = Math.max(0, sigDigits - 1);
    var factor = Math.pow(10, dec);
    mant = Math.round(mant * factor) / factor;
    if (mant >= 10) {
      mant /= 10;
      exp += 1;
    }
    var mStr = mant.toFixed(dec);
    if (!keepZeros) mStr = trimTrailingZeros(mStr);
    return sign + mStr + '×10^' + exp;
  }

  // Đổi sang Độ - Phút - Giây: 12.5 -> 12°30'0"
  CalcEngine.toDMS = function (value) {
    if (!isNum(value)) return 'Lỗi';
    var sign = value < 0 ? '-' : '';
    var av = Math.abs(value);
    var totalSec = Math.round(av * 3600 * 100) / 100;
    var deg = Math.floor(totalSec / 3600 + 1e-9);
    var rem = totalSec - deg * 3600;
    if (rem < 0) rem = 0;
    var min = Math.floor(rem / 60 + 1e-9);
    var sec = rem - min * 60;
    if (Math.abs(sec) < 1e-7) sec = 0;
    sec = Math.round(sec * 100) / 100;
    if (sec >= 60) {
      sec -= 60;
      min += 1;
    }
    if (min >= 60) {
      min -= 60;
      deg += 1;
    }
    return sign + deg + '°' + min + "'" + sec + '"';
  };

  // Đổi phân số p/q sang hỗn số "a b/c"
  CalcEngine.toMixed = function (p, q) {
    if (q === undefined) {
      var fr = findFraction(p, 10000, 1e-12);
      if (!fr) return CalcEngine.format(p);
      p = fr.p;
      q = fr.q;
    }
    if (!isNum(p) || !isNum(q) || q === 0) return 'Lỗi toán';
    p = Math.round(p);
    q = Math.round(q);
    if (q < 0) { p = -p; q = -q; }
    var g = gcdInt(Math.abs(p), q);
    p = Math.round(p / g);
    q = Math.round(q / g);
    if (q === 1) return String(p);
    var sign = p < 0 ? '-' : '';
    var ap = Math.abs(p);
    if (ap < q) return sign + ap + '/' + q;
    var whole = Math.floor(ap / q);
    var rem = ap % q;
    if (rem === 0) return sign + whole;
    return sign + whole + ' ' + rem + '/' + q;
  };

  // Phân tích thừa số nguyên tố (n nguyên dương <= 10^10)
  CalcEngine.factorize = function (n) {
    if (!isNum(n) || n <= 0 || Math.abs(n - Math.round(n)) > 1e-9 || n > 1e10) {
      return 'Lỗi toán';
    }
    n = Math.round(n);
    if (n === 1) return '1';
    var parts = [];
    var d = 2;
    // Máy tính thử các ước nguyên tố hoặc tới sqrt(n)
    // Đặc tả: "thừa số > 1000 chưa tách được thì để trong ngoặc như máy" - chú ý: nếu có ước nguyên tố <= 1000 thì tách hết, phần còn lại nếu > 1:
    // Nếu phần còn lại <= 1000000 thì nó chắc chắn là số nguyên tố (vì không có ước <= 1000); nếu > 1000000 thì kiểm tra tiếp tới sqrt(n) hoặc để trong ngoặc nếu là hợp số/chưa rõ.
    // Trong máy thật (trial division tới ~1013): chia các ước nguyên tố p <= 1009; nếu thương còn lại > 1009^2 thì để trong ngoặc (hoặc thử chia tới sqrt(n) nếu muốn).
    // Hãy chia cho mọi d <= 1009 trước:
    while (d <= 1009 && d * d <= n) {
      if (n % d === 0) {
        var cnt = 0;
        while (n % d === 0) {
          cnt++;
          n = Math.round(n / d);
        }
        parts.push(cnt === 1 ? String(d) : (d + '^' + cnt));
      }
      d = d === 2 ? 3 : d + 2;
    }
    if (n > 1) {
      if (n <= 1009 * 1009) {
        parts.push(String(n));
      } else {
        // Thử kiểm tra xem có tách tiếp được với d <= sqrt(n) không, nhưng nếu đề yêu cầu để trong ngoặc khi thừa số nguyên tố > 1000 chưa tách:
        parts.push('(' + n + ')');
      }
    }
    return parts.join('×');
  };

  // Dạng kỹ thuật (số mũ bội của 3), shiftSteps: số bậc dịch (mặc định 0)
  CalcEngine.toEng = function (value, shiftSteps) {
    if (!isNum(value)) return 'Lỗi';
    shiftSteps = shiftSteps || 0;
    if (value === 0) return '0×10^0';
    var sign = value < 0 ? '-' : '';
    var av = Math.abs(value);
    var exp = Math.floor(Math.log(av) / Math.LN10 + 1e-12);
    var engExp = Math.floor(exp / 3) * 3 - shiftSteps * 3;
    var mant = av / Math.pow(10, engExp);
    mant = Math.round(mant * 1e9) / 1e9;
    var mStr = trimTrailingZeros(mant.toFixed(9));
    return sign + mStr + '×10^' + engExp;
  };

  // Các hàm toán học phụ trợ
  function factorial(n) {
    if (!isNum(n) || n < 0 || n > 69 || Math.abs(n - Math.round(n)) > 1e-9) {
      throw new Error('Lỗi toán');
    }
    n = Math.round(n);
    var res = 1;
    for (var i = 2; i <= n; i++) res *= i;
    return res;
  }

  function combP(n, r) {
    if (!isNum(n) || !isNum(r) || n < 0 || r < 0 ||
        Math.abs(n - Math.round(n)) > 1e-9 || Math.abs(r - Math.round(r)) > 1e-9) {
      throw new Error('Lỗi toán');
    }
    n = Math.round(n);
    r = Math.round(r);
    if (r > n || n > 1e9) throw new Error('Lỗi toán');
    var res = 1;
    for (var i = 0; i < r; i++) {
      res *= (n - i);
      if (!isFinite(res)) throw new Error('Lỗi toán');
    }
    return res;
  }

  function combC(n, r) {
    if (!isNum(n) || !isNum(r) || n < 0 || r < 0 ||
        Math.abs(n - Math.round(n)) > 1e-9 || Math.abs(r - Math.round(r)) > 1e-9) {
      throw new Error('Lỗi toán');
    }
    n = Math.round(n);
    r = Math.round(r);
    if (r > n || n > 1e9) throw new Error('Lỗi toán');
    if (r > n - r) r = n - r;
    var res = 1;
    for (var i = 1; i <= r; i++) {
      res = (res * (n - r + i)) / i;
      if (!isFinite(res)) throw new Error('Lỗi toán');
    }
    return Math.round(res);
  }

  function toRad(val, angleMode) {
    if (angleMode === 'rad') return val;
    if (angleMode === 'gra') return val * Math.PI / 200;
    return val * Math.PI / 180;
  }

  function fromRad(rad, angleMode) {
    if (angleMode === 'rad') return rad;
    if (angleMode === 'gra') return rad * 200 / Math.PI;
    return rad * 180 / Math.PI;
  }

  function trigSin(x, angleMode) {
    if (angleMode === 'deg') {
      var mod = ((x % 360) + 360) % 360;
      if (Math.abs(mod) < 1e-12 || Math.abs(mod - 180) < 1e-12 || Math.abs(mod - 360) < 1e-12) return 0;
      if (Math.abs(mod - 30) < 1e-12 || Math.abs(mod - 150) < 1e-12) return 0.5;
      if (Math.abs(mod - 210) < 1e-12 || Math.abs(mod - 330) < 1e-12) return -0.5;
      if (Math.abs(mod - 90) < 1e-12) return 1;
      if (Math.abs(mod - 270) < 1e-12) return -1;
    } else if (angleMode === 'gra') {
      var modG = ((x % 400) + 400) % 400;
      if (Math.abs(modG) < 1e-12 || Math.abs(modG - 200) < 1e-12 || Math.abs(modG - 400) < 1e-12) return 0;
    }
    var r = toRad(x, angleMode);
    var v = Math.sin(r);
    if (Math.abs(v) < 1e-12 * Math.max(1, Math.abs(x))) return 0;
    return v;
  }

  function trigCos(x, angleMode) {
    if (angleMode === 'deg') {
      var mod = ((x % 360) + 360) % 360;
      if (Math.abs(mod - 90) < 1e-12 || Math.abs(mod - 270) < 1e-12) return 0;
      if (Math.abs(mod - 60) < 1e-12 || Math.abs(mod - 300) < 1e-12) return 0.5;
      if (Math.abs(mod - 120) < 1e-12 || Math.abs(mod - 240) < 1e-12) return -0.5;
      if (Math.abs(mod) < 1e-12 || Math.abs(mod - 360) < 1e-12) return 1;
      if (Math.abs(mod - 180) < 1e-12) return -1;
    } else if (angleMode === 'gra') {
      var modG = ((x % 400) + 400) % 400;
      if (Math.abs(modG - 100) < 1e-12 || Math.abs(modG - 300) < 1e-12) return 0;
    }
    var r = toRad(x, angleMode);
    var v = Math.cos(r);
    if (Math.abs(v) < 1e-12 * Math.max(1, Math.abs(x))) return 0;
    return v;
  }

  function trigTan(x, angleMode) {
    var c = trigCos(x, angleMode);
    if (Math.abs(c) < 1e-12) throw new Error('Lỗi toán');
    var s = trigSin(x, angleMode);
    if (s === 0) return 0;
    if (angleMode === 'deg') {
      var mod = ((x % 180) + 180) % 180;
      if (Math.abs(mod - 45) < 1e-12) return 1;
      if (Math.abs(mod - 135) < 1e-12) return -1;
    }
    return s / c;
  }

  function sinhFn(x) { return (Math.exp(x) - Math.exp(-x)) / 2; }
  function coshFn(x) { return (Math.exp(x) + Math.exp(-x)) / 2; }
  function tanhFn(x) {
    if (x > 20) return 1;
    if (x < -20) return -1;
    var e2 = Math.exp(2 * x);
    return (e2 - 1) / (e2 + 1);
  }
  function asinhFn(x) { return Math.log(x + Math.sqrt(x * x + 1)); }
  function acoshFn(x) {
    if (x < 1) throw new Error('Lỗi toán');
    return Math.log(x + Math.sqrt(x * x - 1));
  }
  function atanhFn(x) {
    if (x <= -1 || x >= 1) throw new Error('Lỗi toán');
    return 0.5 * Math.log((1 + x) / (1 - x));
  }

  // Tích phân Simpson thích nghi / Gauss-Kronrod
  function numericIntegrate(fn, a, b) {
    if (!isNum(a) || !isNum(b)) throw new Error('Lỗi toán');
    if (Math.abs(b - a) < 1e-15) return 0;
    var sign = 1;
    if (a > b) {
      var tmp = a; a = b; b = tmp;
      sign = -1;
    }
    var N = 200; // Chia 200 đoạn Simpson (= 400 điểm)
    var h = (b - a) / N;
    var sum = fn(a) + fn(b);
    for (var i = 1; i < N; i++) {
      var x = a + i * h;
      var y = fn(x);
      if (!isNum(y)) throw new Error('Lỗi toán');
      sum += (i % 2 === 0 ? 2 : 4) * y;
    }
    var val = sign * (h / 3) * sum;
    if (Math.abs(val - Math.round(val)) < 1e-11) val = Math.round(val);
    return val;
  }

  // Đạo hàm số học bậc 4 (Richardson extrapolation)
  function numericDerivative(fn, a) {
    if (!isNum(a)) throw new Error('Lỗi toán');
    var h = Math.max(1e-5, Math.abs(a) * 1e-5);
    var f1 = (fn(a + h) - fn(a - h)) / (2 * h);
    var f2 = (fn(a + h / 2) - fn(a - h / 2)) / h;
    var val = (4 * f2 - f1) / 3;
    if (!isNum(val)) throw new Error('Lỗi toán');
    if (Math.abs(val - Math.round(val)) < 1e-9) val = Math.round(val);
    return val;
  }

  // Tách đối số cấp cao nhất của hàm đặc biệt (integ, deriv, sum, prod)
  function splitTopArgs(str) {
    var args = [];
    var depth = 0;
    var start = 0;
    var inStr = false;
    var quoteChar = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (inStr) {
        if (ch === quoteChar) inStr = false;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inStr = true;
        quoteChar = ch;
        continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        args.push(str.slice(start, i));
        start = i + 1;
      }
    }
    args.push(str.slice(start));
    return args;
  }

  function stripQuotes(s) {
    s = s.replace(/^\s+|\s+$/g, '');
    if (s.length >= 2) {
      var first = s.charAt(0);
      var last = s.charAt(s.length - 1);
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return s.slice(1, -1);
      }
    }
    return s;
  }

  // Bộ từ vựng hóa (Tokenizer) cho biểu thức
  function tokenize(text) {
    var tokens = [];
    var i = 0;
    var len = text.length;

    while (i < len) {
      var ch = text.charAt(i);
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        i++;
        continue;
      }

      // Kiểm tra ÷R (chia có dư)
      if (text.slice(i, i + 2) === '÷R' || text.slice(i, i + 2) === '/R') {
        tokens.push({ type: 'OP', value: '÷R' });
        i += 2;
        continue;
      }

      // Kiểm tra hậu tố ², ³, ⁻¹
      if (text.slice(i, i + 2) === '⁻¹') {
        tokens.push({ type: 'POSTFIX', value: '⁻¹' });
        i += 2;
        continue;
      }
      if (ch === '²' || ch === '³' || ch === '!' || ch === '%') {
        tokens.push({ type: 'POSTFIX', value: ch });
        i++;
        continue;
      }

      // Ký hiệu căn √, ∛
      if (ch === '√') {
        tokens.push({ type: 'FUNC', value: 'sqrt' });
        i++;
        continue;
      }
      if (ch === '∛') {
        tokens.push({ type: 'FUNC', value: 'cbrt' });
        i++;
        continue;
      }

      // Hằng số π
      if (ch === 'π') {
        tokens.push({ type: 'CONST', value: 'pi' });
        i++;
        continue;
      }

      // Dấu phân số dòng ⌟
      if (ch === '⌟') {
        tokens.push({ type: 'OP', value: '⌟' });
        i++;
        continue;
      }

      // Toán tử cơ bản
      if (ch === '+' || ch === '-' || ch === '−' || ch === '*' || ch === '×' || ch === '/' || ch === '÷' || ch === '^') {
        var opVal = ch;
        if (ch === '−') opVal = '-';
        else if (ch === '×') opVal = '*';
        else if (ch === '÷') opVal = '/';
        tokens.push({ type: 'OP', value: opVal });
        i++;
        continue;
      }

      if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }
      if (ch === ',') {
        tokens.push({ type: 'COMMA', value: ',' });
        i++;
        continue;
      }

      // Số thực (bao gồm 1.2E-3)
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        var numStr = '';
        var hasDot = false;
        while (i < len) {
          var c = text.charAt(i);
          if (c >= '0' && c <= '9') {
            numStr += c;
            i++;
          } else if (c === '.' && !hasDot) {
            hasDot = true;
            numStr += c;
            i++;
          } else if ((c === 'E' || c === 'e') && numStr.length > 0 && numStr !== '.') {
            // Kiểm tra xem E có phải ký hiệu khoa học không (theo sau bởi số hoặc +/- rồi số)
            var next1 = text.charAt(i + 1);
            var next2 = text.charAt(i + 2);
            var isSci = (next1 >= '0' && next1 <= '9') ||
                        ((next1 === '+' || next1 === '-' || next1 === '−') && (next2 >= '0' && next2 <= '9'));
            if (isSci && c === 'E') {
              numStr += 'e';
              i++;
              if (text.charAt(i) === '+' || text.charAt(i) === '-' || text.charAt(i) === '−') {
                numStr += (text.charAt(i) === '−' ? '-' : text.charAt(i));
                i++;
              }
              while (i < len && text.charAt(i) >= '0' && text.charAt(i) <= '9') {
                numStr += text.charAt(i);
                i++;
              }
            }
            break;
          } else {
            break;
          }
        }
        if (numStr === '.') throw new Error('Lỗi cú pháp');
        var parsedVal = parseFloat(numStr);
        if (isNaN(parsedVal)) throw new Error('Lỗi cú pháp');
        tokens.push({ type: 'NUM', value: parsedVal });
        continue;
      }

      // Từ định danh (hàm, hằng, biến, nCr, nPr)
      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '#') {
        var rest = text.slice(i);
        // Kiểm tra hàm đặc biệt có biểu thức bên trong: integ, deriv, sum, prod
        var specMatch = rest.match(/^(integ|deriv|sum|prod)\s*\(/);
        if (specMatch) {
          var fnName = specMatch[1];
          var openIdx = i + specMatch[0].length - 1;
          var pDepth = 1;
          var k = openIdx + 1;
          while (k < len && pDepth > 0) {
            var ck = text.charAt(k);
            if (ck === '(') pDepth++;
            else if (ck === ')') pDepth--;
            k++;
          }
          if (pDepth !== 0) throw new Error('Lỗi cú pháp');
          var innerRaw = text.slice(openIdx + 1, k - 1);
          tokens.push({ type: 'SPECIAL_CALL', name: fnName, rawArgs: splitTopArgs(innerRaw) });
          i = k;
          continue;
        }

        // Các từ khóa dài cần ưu tiên khớp trước
        var kwList = [
          'PreAns', 'Ans', 'asinh', 'acosh', 'atanh', 'asin', 'acos', 'atan',
          'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan',
          'sqrt', 'cbrt', 'root', 'abs', 'log', 'ln', 'exp',
          'nPr', 'nCr', 'Pol', 'Rec', 'gcd', 'lcm',
          'intg', 'int', 'round', 'ranint', 'RanInt', 'ran#', 'Ran#', 'ran',
          'frac', 'mixed', 'dms', 'pi'
        ];
        var matchedKw = null;
        for (var kwIdx = 0; kwIdx < kwList.length; kwIdx++) {
          var kw = kwList[kwIdx];
          if (rest.slice(0, kw.length) === kw) {
            // Đảm bảo không cắt ngang một từ khóa thường nếu từ tiếp theo là chữ thường
            var afterCh = rest.charAt(kw.length);
            if (kw === 'int' && afterCh === 'g') continue;
            if (kw === 'ran' && (afterCh === 'i' || afterCh === '#')) continue;
            matchedKw = kw;
            break;
          }
        }

        if (matchedKw) {
          i += matchedKw.length;
          if (matchedKw === 'pi') {
            tokens.push({ type: 'CONST', value: 'pi' });
          } else if (matchedKw === 'Ans' || matchedKw === 'PreAns') {
            tokens.push({ type: 'VAR', value: matchedKw });
          } else if (matchedKw === 'nPr' || matchedKw === 'nCr') {
            tokens.push({ type: 'COMB', value: matchedKw });
          } else if (matchedKw === 'ran#' || matchedKw === 'Ran#') {
            tokens.push({ type: 'CONST', value: 'ran#' });
          } else if (matchedKw === 'RanInt') {
            tokens.push({ type: 'FUNC', value: 'ranint' });
          } else {
            tokens.push({ type: 'FUNC', value: matchedKw });
          }
          continue;
        }

        // Chữ cái đơn: biến A..F, x, y, M, hằng e, hoặc toán tử P, C
        if (ch === 'P') {
          tokens.push({ type: 'COMB', value: 'nPr' });
          i++;
          continue;
        }
        if (ch === 'C') {
          // Chú ý: C có thể là biến C hoặc toán tử tổ hợp nCr (vd 5C2 vs 2C)
          // Nếu ngay sau C là chữ số hoặc '(' hoặc biến và ngay trước C là số/biến/')', thì là nCr!
          var prevTok = tokens.length > 0 ? tokens[tokens.length - 1] : null;
          var nextRest = text.slice(i + 1).replace(/^\s+/, '');
          var nextCh = nextRest.charAt(0);
          var prevIsVal = prevTok && (prevTok.type === 'NUM' || prevTok.type === 'VAR' || prevTok.type === 'RPAREN' || prevTok.type === 'POSTFIX');
          var nextIsVal = (nextCh >= '0' && nextCh <= '9') || nextCh === '(' || nextCh === 'x' || nextCh === 'y' || (nextCh >= 'A' && nextCh <= 'F');
          if (prevIsVal && nextIsVal) {
            tokens.push({ type: 'COMB', value: 'nCr' });
          } else {
            tokens.push({ type: 'VAR', value: 'C' });
          }
          i++;
          continue;
        }
        if (ch === 'e') {
          tokens.push({ type: 'CONST', value: 'e' });
          i++;
          continue;
        }
        if ('ABDEFxyM'.indexOf(ch) !== -1) {
          tokens.push({ type: 'VAR', value: ch });
          i++;
          continue;
        }

        throw new Error('Lỗi cú pháp');
      }

      throw new Error('Lỗi cú pháp');
    }

    return tokens;
  }

  // Đánh giá biểu thức từ danh sách token
  function evaluateTokens(tokens, opts) {
    var pos = 0;
    var angleMode = (opts && opts.angle) || 'deg';
    var vars = (opts && opts.vars) || {};
    var fixDigits = (opts && typeof opts.fix === 'number') ? opts.fix : null;
    var extraResult = null;
    var customExact = null;

    function peek() {
      return pos < tokens.length ? tokens[pos] : null;
    }

    function consume() {
      return tokens[pos++];
    }

    function canStartImplicitFactor(tok) {
      if (!tok) return false;
      return tok.type === 'NUM' || tok.type === 'CONST' || tok.type === 'VAR' ||
             tok.type === 'FUNC' || tok.type === 'SPECIAL_CALL' || tok.type === 'LPAREN';
    }

    // Mức 1: + và -
    function parseAddSub() {
      var left = parseMulDiv();
      while (true) {
        var t = peek();
        if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
          consume();
          var right = parseMulDiv();
          if (t.value === '+') left = left + right;
          else left = left - right;
        } else {
          break;
        }
      }
      return left;
    }

    // Mức 2: *, /, ÷R
    function parseMulDiv() {
      var left = parseComb();
      while (true) {
        var t = peek();
        if (t && t.type === 'OP' && (t.value === '*' || t.value === '/' || t.value === '÷R')) {
          consume();
          var right = parseComb();
          if (t.value === '*') {
            left = left * right;
          } else if (t.value === '/') {
            if (Math.abs(right) < 1e-15) throw new Error('Lỗi toán');
            left = left / right;
          } else if (t.value === '÷R') {
            if (Math.abs(right) < 1e-15 || right < 0 || left < 0 ||
                Math.abs(left - Math.round(left)) > 1e-9 || Math.abs(right - Math.round(right)) > 1e-9) {
              throw new Error('Lỗi toán');
            }
            var nL = Math.round(left);
            var nR = Math.round(right);
            var q = Math.floor(nL / nR);
            var r = nL % nR;
            extraResult = { q: q, r: r };
            customExact = 'q=' + q + ', r=' + r;
            left = q;
          }
        } else {
          break;
        }
      }
      return left;
    }

    // Mức 3: nPr, nCr
    function parseComb() {
      var left = parseUnary();
      while (true) {
        var t = peek();
        if (t && t.type === 'COMB') {
          consume();
          var right = parseUnary();
          if (t.value === 'nPr') left = combP(left, right);
          else left = combC(left, right);
        } else {
          break;
        }
      }
      return left;
    }

    // Mức 4: Toán tử một ngôi + / - (thấp hơn ^ và nhân ngầm để -2^2 = -4 và -2pi = -(2*pi))
    function parseUnary() {
      var t = peek();
      if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
        consume();
        var v = parseUnary();
        return t.value === '-' ? -v : v;
      }
      return parseImplicit();
    }

    // Mức 5: Nhân ngầm (2pi, 2(3+1), 3sqrt(2), 2A)
    function parseImplicit() {
      var left = parseLineFrac();
      while (true) {
        var t = peek();
        if (canStartImplicitFactor(t)) {
          var right = parseLineFrac();
          left = left * right;
        } else {
          break;
        }
      }
      return left;
    }

    // Mức 5.5: Phân số dòng a⌟b hoặc a⌟b⌟c
    function parseLineFrac() {
      var first = parsePow();
      var t = peek();
      if (t && t.type === 'OP' && t.value === '⌟') {
        consume();
        var second = parsePow();
        var t2 = peek();
        if (t2 && t2.type === 'OP' && t2.value === '⌟') {
          consume();
          var third = parsePow();
          if (Math.abs(third) < 1e-15) throw new Error('Lỗi toán');
          var sgn = first < 0 ? -1 : 1;
          return sgn * (Math.abs(first) + second / third);
        }
        if (Math.abs(second) < 1e-15) throw new Error('Lỗi toán');
        return first / second;
      }
      return first;
    }

    // Mức 6: Lũy thừa ^ (kết hợp phải, số mũ có thể có dấu một ngôi như 2^-3)
    function parsePow() {
      var base = parsePostfix();
      var t = peek();
      if (t && t.type === 'OP' && t.value === '^') {
        consume();
        var exp = parsePowExp();
        if (base === 0 && exp <= 0) {
          if (exp < 0) throw new Error('Lỗi toán');
          return 1;
        }
        if (base < 0 && Math.abs(exp - Math.round(exp)) > 1e-9) {
          throw new Error('Lỗi toán');
        }
        var res = Math.pow(base, exp);
        if (!isNum(res)) throw new Error('Lỗi toán');
        return res;
      }
      return base;
    }

    function parsePowExp() {
      var t = peek();
      if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
        consume();
        var v = parsePowExp();
        return t.value === '-' ? -v : v;
      }
      return parsePow();
    }

    // Mức 7: Hậu tố !, %, ², ³, ⁻¹
    function parsePostfix() {
      var val = parseAtom();
      while (true) {
        var t = peek();
        if (t && t.type === 'POSTFIX') {
          consume();
          if (t.value === '!') {
            val = factorial(val);
          } else if (t.value === '%') {
            val = val / 100;
          } else if (t.value === '²') {
            val = val * val;
          } else if (t.value === '³') {
            val = val * val * val;
          } else if (t.value === '⁻¹') {
            if (Math.abs(val) < 1e-15) throw new Error('Lỗi toán');
            val = 1 / val;
          }
        } else {
          break;
        }
      }
      return val;
    }

    // Mức 8: Nguyên tử (số, hằng, biến, ngoặc, lời gọi hàm)
    function parseAtom() {
      var t = peek();
      if (!t) throw new Error('Lỗi cú pháp');

      if (t.type === 'NUM') {
        consume();
        return t.value;
      }

      if (t.type === 'CONST') {
        consume();
        if (t.value === 'pi') return Math.PI;
        if (t.value === 'e') return Math.E;
        if (t.value === 'ran#') return Math.round(Math.random() * 1000) / 1000;
        throw new Error('Lỗi cú pháp');
      }

      if (t.type === 'VAR') {
        consume();
        var vName = t.value;
        if (vars && typeof vars[vName] === 'number' && !isNaN(vars[vName])) {
          return vars[vName];
        }
        return 0;
      }

      if (t.type === 'LPAREN') {
        consume();
        if (peek() && peek().type === 'RPAREN') throw new Error('Lỗi cú pháp');
        var inner = parseAddSub();
        var close = peek();
        // Cho phép tự đóng ngoặc cuối biểu thức giống máy thật
        if (close && close.type === 'RPAREN') {
          consume();
        } else if (pos < tokens.length) {
          throw new Error('Lỗi cú pháp');
        }
        return inner;
      }

      if (t.type === 'SPECIAL_CALL') {
        consume();
        return evalSpecialCall(t.name, t.rawArgs);
      }

      if (t.type === 'FUNC') {
        consume();
        return evalFuncCall(t.value);
      }

      throw new Error('Lỗi cú pháp');
    }

    function evalSpecialCall(name, rawArgs) {
      if (name === 'integ') {
        if (rawArgs.length !== 3) throw new Error('Lỗi cú pháp');
        var fExpr = stripQuotes(rawArgs[0]);
        var aVal = evalSubExpr(rawArgs[1], vars);
        var bVal = evalSubExpr(rawArgs[2], vars);
        return numericIntegrate(function (xVal) {
          var subVars = copyVars(vars);
          subVars.x = xVal;
          return evalSubExpr(fExpr, subVars);
        }, aVal, bVal);
      }
      if (name === 'deriv') {
        if (rawArgs.length !== 2) throw new Error('Lỗi cú pháp');
        var fExprD = stripQuotes(rawArgs[0]);
        var atVal = evalSubExpr(rawArgs[1], vars);
        return numericDerivative(function (xVal) {
          var subVars = copyVars(vars);
          subVars.x = xVal;
          return evalSubExpr(fExprD, subVars);
        }, atVal);
      }
      if (name === 'sum' || name === 'prod') {
        if (rawArgs.length !== 3) throw new Error('Lỗi cú pháp');
        var fExprS = stripQuotes(rawArgs[0]);
        var startV = evalSubExpr(rawArgs[1], vars);
        var endV = evalSubExpr(rawArgs[2], vars);
        if (Math.abs(startV - Math.round(startV)) > 1e-9 || Math.abs(endV - Math.round(endV)) > 1e-9) {
          throw new Error('Lỗi toán');
        }
        var iStart = Math.round(startV);
        var iEnd = Math.round(endV);
        if (iEnd < iStart || iEnd - iStart > 100000) throw new Error('Lỗi toán');
        var acc = name === 'sum' ? 0 : 1;
        for (var idx = iStart; idx <= iEnd; idx++) {
          var subVarsS = copyVars(vars);
          subVarsS.x = idx;
          var term = evalSubExpr(fExprS, subVarsS);
          if (!isNum(term)) throw new Error('Lỗi toán');
          if (name === 'sum') acc += term;
          else acc *= term;
          if (!isFinite(acc)) throw new Error('Lỗi toán');
        }
        return acc;
      }
      throw new Error('Lỗi cú pháp');
    }

    function copyVars(v) {
      var res = {};
      if (!v) return res;
      for (var k in v) {
        if (Object.prototype.hasOwnProperty.call(v, k)) res[k] = v[k];
      }
      return res;
    }

    function evalSubExpr(exprStr, subVars) {
      var r = CalcEngine.evalText(exprStr, { angle: angleMode, vars: subVars, fix: fixDigits, skipExact: true });
      if (!r.ok) throw new Error(r.error || 'Lỗi toán');
      return r.value;
    }

    function evalFuncCall(fn) {
      var args = [];
      var next = peek();
      if (next && next.type === 'LPAREN') {
        consume(); // '('
        if (peek() && peek().type === 'RPAREN') {
          consume();
        } else {
          while (true) {
            args.push(parseAddSub());
            var sep = peek();
            if (sep && sep.type === 'COMMA') {
              consume();
            } else if (sep && sep.type === 'RPAREN') {
              consume();
              break;
            } else if (!sep) {
              // Tự đóng ngoặc ở cuối biểu thức
              break;
            } else {
              throw new Error('Lỗi cú pháp');
            }
          }
        }
      } else {
        // Hỗ trợ viết hàm không ngoặc cho hàm 1 đối số, ví dụ sin 30, √2
        args.push(parseUnary());
      }

      if (fn === 'ran') {
        if (args.length !== 0) throw new Error('Lỗi cú pháp');
        return Math.round(Math.random() * 1000) / 1000;
      }

      if (fn === 'sqrt') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        if (args[0] < 0) throw new Error('Lỗi toán');
        return Math.sqrt(args[0]);
      }
      if (fn === 'cbrt') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        var xC = args[0];
        return xC < 0 ? -Math.pow(-xC, 1 / 3) : Math.pow(xC, 1 / 3);
      }
      if (fn === 'root') {
        if (args.length !== 2) throw new Error('Lỗi cú pháp');
        var nR = args[0];
        var xR = args[1];
        if (Math.abs(nR) < 1e-15) throw new Error('Lỗi toán');
        if (xR < 0) {
          if (Math.abs(nR - Math.round(nR)) > 1e-9) throw new Error('Lỗi toán');
          var nInt = Math.round(nR);
          if (nInt % 2 === 0) throw new Error('Lỗi toán');
          return -Math.pow(-xR, 1 / nInt);
        }
        return Math.pow(xR, 1 / nR);
      }
      if (fn === 'abs') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return Math.abs(args[0]);
      }
      if (fn === 'sin') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return trigSin(args[0], angleMode);
      }
      if (fn === 'cos') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return trigCos(args[0], angleMode);
      }
      if (fn === 'tan') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return trigTan(args[0], angleMode);
      }
      if (fn === 'asin') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        if (args[0] < -1 - 1e-12 || args[0] > 1 + 1e-12) throw new Error('Lỗi toán');
        var cAsin = Math.max(-1, Math.min(1, args[0]));
        return fromRad(Math.asin(cAsin), angleMode);
      }
      if (fn === 'acos') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        if (args[0] < -1 - 1e-12 || args[0] > 1 + 1e-12) throw new Error('Lỗi toán');
        var cAcos = Math.max(-1, Math.min(1, args[0]));
        return fromRad(Math.acos(cAcos), angleMode);
      }
      if (fn === 'atan') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return fromRad(Math.atan(args[0]), angleMode);
      }
      if (fn === 'sinh') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return sinhFn(args[0]);
      }
      if (fn === 'cosh') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return coshFn(args[0]);
      }
      if (fn === 'tanh') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return tanhFn(args[0]);
      }
      if (fn === 'asinh') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return asinhFn(args[0]);
      }
      if (fn === 'acosh') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return acoshFn(args[0]);
      }
      if (fn === 'atanh') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return atanhFn(args[0]);
      }
      if (fn === 'log') {
        if (args.length === 1) {
          if (args[0] <= 0) throw new Error('Lỗi toán');
          return Math.log(args[0]) / Math.LN10;
        }
        if (args.length === 2) {
          var baseL = args[0];
          var valL = args[1];
          if (baseL <= 0 || Math.abs(baseL - 1) < 1e-15 || valL <= 0) throw new Error('Lỗi toán');
          return Math.log(valL) / Math.log(baseL);
        }
        throw new Error('Lỗi cú pháp');
      }
      if (fn === 'ln') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        if (args[0] <= 0) throw new Error('Lỗi toán');
        return Math.log(args[0]);
      }
      if (fn === 'exp') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return Math.exp(args[0]);
      }
      if (fn === 'Pol') {
        if (args.length !== 2) throw new Error('Lỗi cú pháp');
        var px = args[0], py = args[1];
        var pr = Math.sqrt(px * px + py * py);
        var ptheta = fromRad(Math.atan2(py, px), angleMode);
        extraResult = [pr, ptheta];
        return pr;
      }
      if (fn === 'Rec') {
        if (args.length !== 2) throw new Error('Lỗi cú pháp');
        var rr = args[0], rtheta = args[1];
        var rx = rr * trigCos(rtheta, angleMode);
        var ry = rr * trigSin(rtheta, angleMode);
        extraResult = [rx, ry];
        return rx;
      }
      if (fn === 'gcd') {
        if (args.length < 2) throw new Error('Lỗi cú pháp');
        var gRes = args[0];
        for (var gi = 1; gi < args.length; gi++) {
          if (Math.abs(gRes - Math.round(gRes)) > 1e-9 || Math.abs(args[gi] - Math.round(args[gi])) > 1e-9) {
            throw new Error('Lỗi toán');
          }
          gRes = gcdInt(gRes, args[gi]);
        }
        return gRes;
      }
      if (fn === 'lcm') {
        if (args.length < 2) throw new Error('Lỗi cú pháp');
        var lRes = args[0];
        for (var li = 1; li < args.length; li++) {
          if (Math.abs(lRes - Math.round(lRes)) > 1e-9 || Math.abs(args[li] - Math.round(args[li])) > 1e-9) {
            throw new Error('Lỗi toán');
          }
          lRes = lcmInt(lRes, args[li]);
        }
        return lRes;
      }
      if (fn === 'int') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return args[0] < 0 ? Math.ceil(args[0] - 1e-12) : Math.floor(args[0] + 1e-12);
      }
      if (fn === 'intg') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return Math.floor(args[0] + 1e-12);
      }
      if (fn === 'round') {
        if (args.length === 1) {
          var dRnd = fixDigits !== null ? fixDigits : 0;
          var fRnd = Math.pow(10, dRnd);
          return Math.round(args[0] * fRnd) / fRnd;
        }
        if (args.length === 2) {
          var fRnd2 = Math.pow(10, Math.round(args[1]));
          return Math.round(args[0] * fRnd2) / fRnd2;
        }
        throw new Error('Lỗi cú pháp');
      }
      if (fn === 'ranint') {
        if (args.length !== 2) throw new Error('Lỗi cú pháp');
        var rA = Math.round(args[0]);
        var rB = Math.round(args[1]);
        if (rA > rB) throw new Error('Lỗi toán');
        return rA + Math.floor(Math.random() * (rB - rA + 1));
      }
      if (fn === 'frac') {
        if (args.length !== 2) throw new Error('Lỗi cú pháp');
        if (Math.abs(args[1]) < 1e-15) throw new Error('Lỗi toán');
        return args[0] / args[1];
      }
      if (fn === 'mixed') {
        if (args.length !== 3) throw new Error('Lỗi cú pháp');
        if (Math.abs(args[2]) < 1e-15) throw new Error('Lỗi toán');
        var mSign = args[0] < 0 ? -1 : 1;
        return mSign * (Math.abs(args[0]) + args[1] / args[2]);
      }
      if (fn === 'dms') {
        if (args.length < 1 || args.length > 3) throw new Error('Lỗi cú pháp');
        var dVal = args[0] || 0;
        var mVal = args[1] || 0;
        var sVal = args[2] || 0;
        var dSign = dVal < 0 ? -1 : 1;
        return dSign * (Math.abs(dVal) + mVal / 60 + sVal / 3600);
      }

      throw new Error('Lỗi cú pháp');
    }

    var value = parseAddSub();
    if (pos < tokens.length) {
      throw new Error('Lỗi cú pháp');
    }
    if (!isNum(value)) {
      throw new Error('Lỗi toán');
    }
    return { value: value, extra: extraResult, customExact: customExact };
  }

  // API chính: tính giá trị biểu thức văn bản
  CalcEngine.evalText = function (text, opts) {
    opts = opts || {};
    if (typeof text !== 'string') {
      return { ok: false, error: 'Lỗi cú pháp' };
    }
    var trimmed = text.replace(/^\s+|\s+$/g, '');
    if (!trimmed) {
      return { ok: false, error: 'Lỗi cú pháp' };
    }

    try {
      var tokens = tokenize(trimmed);
      if (tokens.length === 0) {
        return { ok: false, error: 'Lỗi cú pháp' };
      }
      var res = evaluateTokens(tokens, opts);
      var val = res.value;
      if (Math.abs(val) < 1e-14) val = 0;
      else if (Math.abs(val - Math.round(val)) < 1e-13 * Math.max(1, Math.abs(val))) {
        val = Math.round(val);
      }
      var exact = opts.skipExact ? null : (res.customExact || CalcEngine.toExact(val));
      var decimal = CalcEngine.format(val, opts.format);
      var out = {
        ok: true,
        value: val,
        exact: exact,
        decimal: decimal
      };
      if (res.extra !== null && res.extra !== undefined) {
        out.extra = res.extra;
      }
      return out;
    } catch (e) {
      var msg = (e && e.message) ? e.message : 'Lỗi toán';
      if (msg !== 'Lỗi toán' && msg !== 'Lỗi cú pháp' && msg !== 'Lỗi ngăn xếp') {
        msg = 'Lỗi toán';
      }
      return { ok: false, error: msg };
    }
  };

  // Biểu diễn dạng chính xác của số phức a + bi
  function formatComplexExact(re, im) {
    if (Math.abs(im) < 1e-10) {
      return CalcEngine.toExact(re) || CalcEngine.format(re);
    }
    var absIm = Math.abs(im);
    var imEx = Math.abs(absIm - 1) < 1e-10 ? '' : (CalcEngine.toExact(absIm) || CalcEngine.format(absIm));
    var needSpace = imEx.indexOf('/') !== -1 || imEx.indexOf('√') !== -1;
    var imUnit = imEx + (needSpace ? ' i' : 'i');

    if (Math.abs(re) < 1e-10) {
      return (im < 0 ? '-' : '') + imUnit;
    }
    var reEx = CalcEngine.toExact(re) || CalcEngine.format(re);
    return reEx + (im < 0 ? '-' : '+') + imUnit;
  }

  // Tính giá trị đa thức và đạo hàm tại số phức z = (re, im)
  function evalPolyComplex(coeffs, re, im) {
    var vRe = coeffs[0], vIm = 0;
    var dRe = 0, dIm = 0;
    var d2Re = 0, d2Im = 0;
    for (var i = 1; i < coeffs.length; i++) {
      // d2 = d2 * z + 2 * d
      var nd2Re = d2Re * re - d2Im * im + 2 * dRe;
      var nd2Im = d2Re * im + d2Im * re + 2 * dIm;
      d2Re = nd2Re; d2Im = nd2Im;
      // d = d * z + v
      var ndRe = dRe * re - dIm * im + vRe;
      var ndIm = dRe * im + dIm * re + vIm;
      dRe = ndRe; dIm = ndIm;
      // v = v * z + coeffs[i]
      var nvRe = vRe * re - vIm * im + coeffs[i];
      var nvIm = vRe * im + vIm * re;
      vRe = nvRe; vIm = nvIm;
    }
    return {
      vRe: vRe, vIm: vIm,
      dRe: dRe, dIm: dIm,
      d2Re: d2Re, d2Im: d2Im
    };
  }

  // Giải phương trình đa thức bậc 2, 3, 4
  CalcEngine.solvePoly = function (coeffs) {
    if (!coeffs || coeffs.length < 3 || coeffs.length > 5) {
      return { error: 'Lỗi cú pháp', roots: [] };
    }
    var a0 = coeffs[0];
    if (!isNum(a0) || Math.abs(a0) < 1e-15) {
      return { error: 'Lỗi toán', roots: [] };
    }
    var deg = coeffs.length - 1;

    // Bậc 2: xử lý trực tiếp bằng biệt thức Delta
    if (deg === 2) {
      var a = coeffs[0], b = coeffs[1], c = coeffs[2];
      var vx = -b / (2 * a);
      var vy = c - (b * b) / (4 * a);
      if (Math.abs(vx) < 1e-14) vx = 0;
      if (Math.abs(vy) < 1e-14) vy = 0;
      var extremum = {
        x: vx,
        y: vy,
        xExact: CalcEngine.toExact(vx),
        yExact: CalcEngine.toExact(vy)
      };
      var delta = b * b - 4 * a * c;
      var scale = Math.max(1, b * b, Math.abs(4 * a * c));
      if (Math.abs(delta) <= 1e-11 * scale) {
        return {
          roots: [{ re: vx, im: 0, exact: CalcEngine.toExact(vx) }],
          extremum: extremum
        };
      }
      if (delta > 0) {
        var sd = Math.sqrt(delta);
        var r1 = (-b + sd) / (2 * a);
        var r2 = (-b - sd) / (2 * a);
        if (r1 < r2) { var t = r1; r1 = r2; r2 = t; }
        if (Math.abs(r1) < 1e-14) r1 = 0;
        if (Math.abs(r2) < 1e-14) r2 = 0;
        return {
          roots: [
            { re: r1, im: 0, exact: CalcEngine.toExact(r1) },
            { re: r2, im: 0, exact: CalcEngine.toExact(r2) }
          ],
          extremum: extremum
        };
      }
      var imPart = Math.sqrt(-delta) / Math.abs(2 * a);
      return {
        roots: [
          { re: vx, im: imPart, exact: formatComplexExact(vx, imPart) },
          { re: vx, im: -imPart, exact: formatComplexExact(vx, -imPart) }
        ],
        extremum: extremum
      };
    }

    // Chuẩn hóa hệ số bậc cao nhất về 1
    var norm = [];
    for (var i = 0; i <= deg; i++) {
      norm.push(coeffs[i] / a0);
    }

    // Khởi tạo nghiệm bằng phương pháp Durand-Kerner (Weierstrass)
    var roots = [];
    var radius = 1;
    for (var j = 1; j <= deg; j++) {
      radius = Math.max(radius, Math.pow(Math.abs(norm[j]), 1 / j));
    }
    radius = radius * 1.2 + 0.5;
    for (var k = 0; k < deg; k++) {
      var ang = (2 * Math.PI * k) / deg + 0.37;
      roots.push({
        re: radius * Math.cos(ang),
        im: radius * Math.sin(ang)
      });
    }

    for (var iter = 0; iter < 300; iter++) {
      var maxShift = 0;
      for (var m = 0; m < deg; m++) {
        var z = roots[m];
        var ev = evalPolyComplex(norm, z.re, z.im);
        var denRe = 1, denIm = 0;
        for (var q = 0; q < deg; q++) {
          if (q === m) continue;
          var diffRe = z.re - roots[q].re;
          var diffIm = z.im - roots[q].im;
          if (Math.abs(diffRe) < 1e-14 && Math.abs(diffIm) < 1e-14) {
            diffRe = 1e-7 * (m + 1);
            diffIm = 1e-7 * (q + 1);
          }
          var nDenRe = denRe * diffRe - denIm * diffIm;
          var nDenIm = denRe * diffIm + denIm * diffRe;
          denRe = nDenRe; denIm = nDenIm;
        }
        var dMag2 = denRe * denRe + denIm * denIm;
        if (dMag2 < 1e-30) continue;
        var stepRe = (ev.vRe * denRe + ev.vIm * denIm) / dMag2;
        var stepIm = (ev.vIm * denRe - ev.vRe * denIm) / dMag2;
        z.re -= stepRe;
        z.im -= stepIm;
        var shift = Math.sqrt(stepRe * stepRe + stepIm * stepIm);
        if (shift > maxShift) maxShift = shift;
      }
      if (maxShift < 1e-14) break;
    }

    // Tinh chỉnh từng nghiệm bằng Newton (kể cả nghiệm bội bằng u = P/P')
    for (var p = 0; p < deg; p++) {
      var rz = roots[p];
      for (var nIt = 0; nIt < 30; nIt++) {
        var info = evalPolyComplex(norm, rz.re, rz.im);
        var d2 = info.dRe * info.dRe + info.dIm * info.dIm;
        if (d2 > 1e-12) {
          var sRe = (info.vRe * info.dRe + info.vIm * info.dIm) / d2;
          var sIm = (info.vIm * info.dRe - info.vRe * info.dIm) / d2;
          rz.re -= sRe;
          rz.im -= sIm;
        } else {
          // Nghiệm bội: dùng bước Newton cho P'(z) = 0 nếu P''(z) != 0
          var d2Mag = info.d2Re * info.d2Re + info.d2Im * info.d2Im;
          if (d2Mag > 1e-12) {
            var sRe2 = (info.dRe * info.d2Re + info.dIm * info.d2Im) / d2Mag;
            var sIm2 = (info.dIm * info.d2Re - info.dRe * info.d2Im) / d2Mag;
            rz.re -= sRe2;
            rz.im -= sIm2;
          }
        }
      }
      if (Math.abs(rz.im) < 1e-7) rz.im = 0;
      if (Math.abs(rz.re) < 1e-12) rz.re = 0;
      if (rz.im === 0) {
        // Làm tròn về số nguyên / phân số nếu rất gần
        var rRound = Math.round(rz.re);
        if (Math.abs(rz.re - rRound) < 1e-6) {
          var checkInt = evalPolyComplex(norm, rRound, 0);
          if (Math.abs(checkInt.vRe) < 1e-11) rz.re = rRound;
        } else {
          var fr = findFraction(rz.re, 1000, 1e-7);
          if (fr) {
            var fVal = fr.p / fr.q;
            var checkFr = evalPolyComplex(norm, fVal, 0);
            if (Math.abs(checkFr.vRe) < 1e-11) rz.re = fVal;
          }
        }
      }
    }

    // Gộp các nghiệm trùng nhau (nghiệm bội liệt kê 1 lần)
    var uniqueRoots = [];
    for (var u = 0; u < roots.length; u++) {
      var cand = roots[u];
      var dup = false;
      for (var v = 0; v < uniqueRoots.length; v++) {
        var ex = uniqueRoots[v];
        var dist = Math.sqrt((cand.re - ex.re) * (cand.re - ex.re) + (cand.im - ex.im) * (cand.im - ex.im));
        if (dist < 1e-5) {
          dup = true;
          break;
        }
      }
      if (!dup) {
        uniqueRoots.push(cand);
      }
    }

    // Sắp xếp: nghiệm thực trước (giảm dần); nghiệm phức sau (phần ảo dương trước)
    uniqueRoots.sort(function (rA, rB) {
      var aReal = rA.im === 0;
      var bReal = rB.im === 0;
      if (aReal && !bReal) return -1;
      if (!aReal && bReal) return 1;
      if (aReal && bReal) return rB.re - rA.re;
      // Cả hai là nghiệm phức: nếu cùng cặp liên hợp thì phần ảo dương trước
      if (Math.abs(rA.re - rB.re) < 1e-6) {
        return rB.im - rA.im;
      }
      return rB.re - rA.re;
    });

    var formattedRoots = [];
    for (var fi = 0; fi < uniqueRoots.length; fi++) {
      var rt = uniqueRoots[fi];
      formattedRoots.push({
        re: rt.re,
        im: rt.im,
        exact: rt.im === 0 ? CalcEngine.toExact(rt.re) : formatComplexExact(rt.re, rt.im)
      });
    }

    return { roots: formattedRoots };
  };

  // Giải hệ phương trình tuyến tính n ẩn (n = 2, 3, 4) bằng khử Gauss có chọn phần tử trụ
  CalcEngine.solveLinear = function (A, b) {
    if (!A || !b || A.length !== b.length || A.length < 2 || A.length > 4) {
      return { error: 'Lỗi cú pháp' };
    }
    var n = A.length;
    var M = [];
    for (var i = 0; i < n; i++) {
      if (!A[i] || A[i].length !== n) return { error: 'Lỗi cú pháp' };
      var row = [];
      for (var j = 0; j < n; j++) row.push(Number(A[i][j]));
      row.push(Number(b[i]));
      M.push(row);
    }

    var rowPivot = 0;
    for (var col = 0; col < n && rowPivot < n; col++) {
      var maxRow = rowPivot;
      var maxVal = Math.abs(M[rowPivot][col]);
      for (var r = rowPivot + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > maxVal) {
          maxVal = Math.abs(M[r][col]);
          maxRow = r;
        }
      }
      if (maxVal < 1e-12) continue;

      var tmp = M[rowPivot];
      M[rowPivot] = M[maxRow];
      M[maxRow] = tmp;

      var piv = M[rowPivot][col];
      for (var c = col; c <= n; c++) {
        M[rowPivot][c] /= piv;
      }

      for (var r2 = 0; r2 < n; r2++) {
        if (r2 === rowPivot) continue;
        var factor = M[r2][col];
        if (Math.abs(factor) > 1e-15) {
          for (var c2 = col; c2 <= n; c2++) {
            M[r2][c2] -= factor * M[rowPivot][c2];
          }
        }
      }
      rowPivot++;
    }

    // Kiểm tra hàng toàn 0
    for (var rCheck = 0; rCheck < n; rCheck++) {
      var allZero = true;
      for (var cCheck = 0; cCheck < n; cCheck++) {
        if (Math.abs(M[rCheck][cCheck]) > 1e-11) {
          allZero = false;
          break;
        }
      }
      if (allZero) {
        if (Math.abs(M[rCheck][n]) > 1e-11) {
          return { error: 'Vô nghiệm' };
        }
      }
    }
    if (rowPivot < n) {
      return { error: 'Vô số nghiệm' };
    }

    var sol = [];
    var ex = [];
    for (var k = 0; k < n; k++) {
      var val = M[k][n];
      if (Math.abs(val) < 1e-13) val = 0;
      else if (Math.abs(val - Math.round(val)) < 1e-12) val = Math.round(val);
      sol.push(val);
      ex.push(CalcEngine.toExact(val));
    }
    return { solution: sol, exact: ex };
  };

  // Giải bất phương trình đa thức bậc 2, 3, 4: coeffs, op in ['>', '<', '>=', '<=']
  CalcEngine.solveIneq = function (coeffs, op) {
    if (!coeffs || coeffs.length < 3 || coeffs.length > 5) {
      return { text: 'Lỗi cú pháp', intervals: [] };
    }
    if (op === '≥') op = '>=';
    if (op === '≤') op = '<=';
    if (op !== '>' && op !== '<' && op !== '>=' && op !== '<=') {
      return { text: 'Lỗi cú pháp', intervals: [] };
    }

    var polyRes = CalcEngine.solvePoly(coeffs);
    if (polyRes.error) return { text: polyRes.error, intervals: [] };

    var realRoots = [];
    for (var i = 0; i < polyRes.roots.length; i++) {
      if (Math.abs(polyRes.roots[i].im) < 1e-9) {
        realRoots.push(polyRes.roots[i].re);
      }
    }
    realRoots.sort(function (a, b) { return a - b; });

    function evalRealPoly(x) {
      var v = coeffs[0];
      for (var j = 1; j < coeffs.length; j++) {
        v = v * x + coeffs[j];
      }
      return v;
    }

    function fmtBound(v) {
      return CalcEngine.toExact(v) || CalcEngine.format(v);
    }

    var allowZero = (op === '>=' || op === '<=');
    var wantPos = (op === '>' || op === '>=');
    var k = realRoots.length;

    // Đánh dấu dấu trên k+1 khoảng mở và tại k nghiệm
    var openOk = [];
    for (var idx = 0; idx <= k; idx++) {
      var testX;
      if (k === 0) testX = 0;
      else if (idx === 0) testX = realRoots[0] - Math.max(1, Math.abs(realRoots[0]));
      else if (idx === k) testX = realRoots[k - 1] + Math.max(1, Math.abs(realRoots[k - 1]));
      else testX = 0.5 * (realRoots[idx - 1] + realRoots[idx]);
      var pv = evalRealPoly(testX);
      openOk.push(wantPos ? (pv > 0) : (pv < 0));
    }

    // Gom thành các đoạn liên thông
    var segments = [];
    var cur = null;

    for (var s = 0; s <= k; s++) {
      if (openOk[s]) {
        var leftVal = (s === 0) ? -Infinity : realRoots[s - 1];
        var leftClosed = (s === 0) ? false : allowZero;
        if (!cur) {
          cur = {
            min: leftVal,
            max: (s === k) ? Infinity : realRoots[s],
            minClosed: leftClosed,
            maxClosed: (s === k) ? false : allowZero
          };
        } else {
          cur.max = (s === k) ? Infinity : realRoots[s];
          cur.maxClosed = (s === k) ? false : allowZero;
        }
      } else {
        if (cur) {
          segments.push(cur);
          cur = null;
        }
        // Kiểm tra nghiệm cô lập khi allowZero = true và cả hai khoảng quanh nó đều false
        if (s < k && allowZero && !openOk[s] && !openOk[s + 1]) {
          segments.push({
            min: realRoots[s],
            max: realRoots[s],
            minClosed: true,
            maxClosed: true
          });
        }
      }
    }
    if (cur) segments.push(cur);

    if (segments.length === 0) {
      return { text: 'Vô nghiệm', intervals: [] };
    }
    if (segments.length === 1 && segments[0].min === -Infinity && segments[0].max === Infinity) {
      return { text: 'Mọi số thực', intervals: segments };
    }

    var parts = [];
    for (var m = 0; m < segments.length; m++) {
      var seg = segments[m];
      if (seg.min !== -Infinity && seg.max !== Infinity && Math.abs(seg.min - seg.max) < 1e-12) {
        parts.push('x=' + fmtBound(seg.min));
      } else if (seg.min === -Infinity) {
        parts.push('x' + (seg.maxClosed ? '≤' : '<') + fmtBound(seg.max));
      } else if (seg.max === Infinity) {
        parts.push(fmtBound(seg.min) + (seg.minClosed ? '≤' : '<') + 'x');
      } else {
        parts.push(
          fmtBound(seg.min) +
          (seg.minClosed ? '≤' : '<') +
          'x' +
          (seg.maxClosed ? '≤' : '<') +
          fmtBound(seg.max)
        );
      }
    }

    return {
      text: parts.join(', '),
      intervals: segments
    };
  };

  // SOLVE số học: tìm nghiệm x cho exprText (có thể chứa dấu =)
  CalcEngine.solveNumeric = function (exprText, guess, opts) {
    opts = opts || {};
    if (typeof exprText !== 'string' || !exprText.replace(/\s+/g, '')) {
      return { error: 'Lỗi cú pháp' };
    }
    var eqParts = exprText.split('=');
    var lhsText, rhsText;
    if (eqParts.length === 1) {
      lhsText = eqParts[0];
      rhsText = '0';
    } else if (eqParts.length === 2) {
      lhsText = eqParts[0];
      rhsText = eqParts[1];
    } else {
      return { error: 'Lỗi cú pháp' };
    }

    var x0 = isNum(guess) ? guess : 0;
    var baseVars = {};
    if (opts.vars) {
      for (var k in opts.vars) {
        if (Object.prototype.hasOwnProperty.call(opts.vars, k)) baseVars[k] = opts.vars[k];
      }
    }

    function f(xVal) {
      baseVars.x = xVal;
      var lRes = CalcEngine.evalText(lhsText, { angle: opts.angle, vars: baseVars, skipExact: true });
      if (!lRes.ok) return NaN;
      var rRes = CalcEngine.evalText(rhsText, { angle: opts.angle, vars: baseVars, skipExact: true });
      if (!rRes.ok) return NaN;
      return lRes.value - rRes.value;
    }

    var x = x0;
    var fx = f(x);
    if (isNaN(fx)) {
      // Thử một số điểm xuất phát khác nếu điểm đoán ban đầu không xác định
      var fallbacks = [1, 0.5, 2, -1, 0.1, 5];
      for (var fi = 0; fi < fallbacks.length; fi++) {
        x = fallbacks[fi];
        fx = f(x);
        if (!isNaN(fx)) break;
      }
      if (isNaN(fx)) return { error: 'Lỗi toán' };
    }

    // Phương pháp Newton kết hợp dây cung / chia đôi
    var converged = false;
    for (var iter = 0; iter < 80; iter++) {
      fx = f(x);
      if (isNaN(fx)) break;
      if (Math.abs(fx) < 1e-13) {
        converged = true;
        break;
      }
      var h = Math.max(1e-6, Math.abs(x) * 1e-6);
      var fPlus = f(x + h);
      var fMinus = f(x - h);
      var df = (fPlus - fMinus) / (2 * h);
      if (isNaN(df) || Math.abs(df) < 1e-14) {
        x += (iter % 2 === 0 ? 0.37 : -0.73);
        continue;
      }
      var step = fx / df;
      // Giảm bước nếu quá lớn hoặc nhảy ra miền không xác định
      var damp = 1;
      var nextX = x - step;
      while (damp > 1 / 64 && isNaN(f(nextX))) {
        damp *= 0.5;
        nextX = x - damp * step;
      }
      x = nextX;
      if (Math.abs(step * damp) < 1e-13) {
        fx = f(x);
        if (!isNaN(fx) && Math.abs(fx) < 1e-7) {
          converged = true;
          break;
        }
      }
    }

    // Nếu chưa hội tụ, quét tìm khoảng đổi dấu rồi chia đôi (bisection)
    if (!converged) {
      var grid = [-100, -50, -20, -10, -5, -2, -1, -0.5, 0, 0.5, 1, 2, 5, 10, 20, 50, 100];
      var aB = null, bB = null, fa = 0, fb = 0;
      for (var gi = 0; gi < grid.length - 1; gi++) {
        var v1 = f(grid[gi]);
        var v2 = f(grid[gi + 1]);
        if (!isNaN(v1) && Math.abs(v1) < 1e-12) {
          x = grid[gi]; fx = v1; converged = true; break;
        }
        if (!isNaN(v1) && !isNaN(v2) && v1 * v2 <= 0) {
          aB = grid[gi]; bB = grid[gi + 1];
          fa = v1; fb = v2;
          break;
        }
      }
      if (!converged && aB !== null) {
        for (var bi = 0; bi < 70; bi++) {
          var mid = 0.5 * (aB + bB);
          var fmid = f(mid);
          if (isNaN(fmid)) break;
          if (Math.abs(fmid) < 1e-13 || Math.abs(bB - aB) < 1e-13) {
            x = mid; fx = fmid; converged = true; break;
          }
          if (fa * fmid <= 0) {
            bB = mid; fb = fmid;
          } else {
            aB = mid; fa = fmid;
          }
          x = mid; fx = fmid;
        }
        if (Math.abs(fx) < 1e-6) converged = true;
      }
    }

    fx = f(x);
    if (isNaN(fx) || Math.abs(fx) > 1e-4) {
      return { error: 'Không tìm thấy nghiệm' };
    }
    if (Math.abs(x) < 1e-13) x = 0;
    else if (Math.abs(x - Math.round(x)) < 1e-11) x = Math.round(x);
    fx = f(x);
    if (Math.abs(fx) < 1e-14) fx = 0;
    return { x: x, lr: fx };
  };

  // Bảng giá trị f(x) và g(x) (tối đa 45 dòng)
  CalcEngine.table = function (fText, gText, start, end, step, opts) {
    opts = opts || {};
    if (!isNum(start) || !isNum(end) || !isNum(step) || step <= 0 || end < start) {
      return { ok: false, error: 'Quá phạm vi' };
    }
    var count = Math.floor((end - start) / step + 1e-9) + 1;
    if (count > 45 || count < 1) {
      return { ok: false, error: 'Quá phạm vi' };
    }
    var hasG = typeof gText === 'string' && gText.replace(/\s+/g, '').length > 0;
    var baseVars = {};
    if (opts.vars) {
      for (var k in opts.vars) {
        if (Object.prototype.hasOwnProperty.call(opts.vars, k)) baseVars[k] = opts.vars[k];
      }
    }

    var rows = [];
    for (var i = 0; i < count; i++) {
      var xVal = start + i * step;
      if (Math.abs(xVal - Math.round(xVal)) < 1e-12) xVal = Math.round(xVal);
      else xVal = Math.round(xVal * 1e10) / 1e10;

      baseVars.x = xVal;
      var fRes = CalcEngine.evalText(fText, { angle: opts.angle, vars: baseVars, skipExact: true });
      var fVal = fRes.ok ? fRes.value : 'Lỗi';

      var row = { x: xVal, f: fVal };
      if (hasG) {
        var gRes = CalcEngine.evalText(gText, { angle: opts.angle, vars: baseVars, skipExact: true });
        row.g = gRes.ok ? gRes.value : 'Lỗi';
      } else {
        row.g = null;
      }
      rows.push(row);
    }
    rows.ok = true;
    rows.rows = rows;
    return rows;
  };

  // Tính trung vị của mảng đã sắp xếp
  function calcMedian(sorted) {
    var len = sorted.length;
    if (len === 0) return NaN;
    var mid = Math.floor(len / 2);
    if (len % 2 === 1) return sorted[mid];
    return 0.5 * (sorted[mid - 1] + sorted[mid]);
  }

  // Thống kê 1 biến
  CalcEngine.stat1 = function (xs, freqs) {
    if (!xs || xs.length === 0) return { error: 'Lỗi toán' };
    var n = 0;
    var sumx = 0;
    var sumx2 = 0;
    var expanded = [];
    var freqMap = {};
    var maxFreq = 0;

    for (var i = 0; i < xs.length; i++) {
      var x = Number(xs[i]);
      var fr = (freqs && freqs[i] !== undefined) ? Number(freqs[i]) : 1;
      if (!isNum(x) || !isNum(fr) || fr < 0 || Math.abs(fr - Math.round(fr)) > 1e-9) {
        return { error: 'Lỗi toán' };
      }
      fr = Math.round(fr);
      if (fr === 0) continue;
      n += fr;
      sumx += x * fr;
      sumx2 += x * x * fr;
      for (var c = 0; c < fr; c++) expanded.push(x);
      var key = String(x);
      freqMap[key] = (freqMap[key] || 0) + fr;
      if (freqMap[key] > maxFreq) maxFreq = freqMap[key];
    }

    if (n === 0) return { error: 'Lỗi toán' };
    expanded.sort(function (a, b) { return a - b; });

    var mean = sumx / n;
    var varPop = Math.max(0, (sumx2 - n * mean * mean) / n);
    var sigma = Math.sqrt(varPop);
    var s = n > 1 ? Math.sqrt(Math.max(0, (sumx2 - n * mean * mean) / (n - 1))) : NaN;

    var min = expanded[0];
    var max = expanded[expanded.length - 1];
    var med = calcMedian(expanded);
    var half = Math.floor(n / 2);
    var lowerHalf = expanded.slice(0, half);
    var upperHalf = (n % 2 === 0) ? expanded.slice(half) : expanded.slice(half + 1);
    var q1 = n === 1 ? expanded[0] : calcMedian(lowerHalf);
    var q3 = n === 1 ? expanded[0] : calcMedian(upperHalf);

    var modes = [];
    for (var k in freqMap) {
      if (Object.prototype.hasOwnProperty.call(freqMap, k) && freqMap[k] === maxFreq) {
        modes.push(Number(k));
      }
    }
    modes.sort(function (a, b) { return a - b; });

    return {
      n: n,
      mean: mean,
      sumx: sumx,
      sumx2: sumx2,
      sigma: sigma,
      s: s,
      min: min,
      q1: q1,
      med: med,
      q3: q3,
      max: max,
      mode: modes.length === 1 ? modes[0] : modes[0],
      modes: modes
    };
  };

  // Thống kê 2 biến và hồi quy
  // type: 'lin' (y=a+bx), 'quad' (y=a+bx+cx^2), 'log' (y=a+b*lnx),
  // 'exp' (y=a*e^(bx)), 'abexp' (y=a*b^x), 'pow' (y=a*x^b), 'inv' (y=a+b/x)
  CalcEngine.stat2 = function (xs, ys, freqs, type) {
    if (!xs || !ys || xs.length === 0 || xs.length !== ys.length) {
      return { error: 'Lỗi toán' };
    }
    type = type || 'lin';

    var n = 0;
    var sumx = 0, sumy = 0, sumxy = 0, sumx2 = 0, sumy2 = 0;
    var sumx3 = 0, sumx4 = 0, sumx2y = 0;
    var pts = [];

    for (var i = 0; i < xs.length; i++) {
      var x = Number(xs[i]);
      var y = Number(ys[i]);
      var fr = (freqs && freqs[i] !== undefined) ? Number(freqs[i]) : 1;
      if (!isNum(x) || !isNum(y) || !isNum(fr) || fr < 0 || Math.abs(fr - Math.round(fr)) > 1e-9) {
        return { error: 'Lỗi toán' };
      }
      fr = Math.round(fr);
      if (fr === 0) continue;
      n += fr;
      sumx += x * fr;
      sumy += y * fr;
      sumxy += x * y * fr;
      sumx2 += x * x * fr;
      sumy2 += y * y * fr;
      sumx3 += x * x * x * fr;
      sumx4 += x * x * x * x * fr;
      sumx2y += x * x * y * fr;
      pts.push({ x: x, y: y, f: fr });
    }

    if (n < 2) return { error: 'Lỗi toán' };

    var meanx = sumx / n;
    var meany = sumy / n;
    var sigmax = Math.sqrt(Math.max(0, (sumx2 - n * meanx * meanx) / n));
    var sigmay = Math.sqrt(Math.max(0, (sumy2 - n * meany * meany) / n));
    var sx = Math.sqrt(Math.max(0, (sumx2 - n * meanx * meanx) / (n - 1)));
    var sy = Math.sqrt(Math.max(0, (sumy2 - n * meany * meany) / (n - 1)));

    // Hồi quy tuyến tính trên biến đã biến đổi (U, V)
    function linRegTransformed(uFn, vFn) {
      var su = 0, sv = 0, suv = 0, su2 = 0, sv2 = 0;
      for (var j = 0; j < pts.length; j++) {
        var u = uFn(pts[j].x);
        var v = vFn(pts[j].y);
        if (!isNum(u) || !isNum(v)) return null;
        var f = pts[j].f;
        su += u * f;
        sv += v * f;
        suv += u * v * f;
        su2 += u * u * f;
        sv2 += v * v * f;
      }
      var sxx = su2 - (su * su) / n;
      var syy = sv2 - (sv * sv) / n;
      var sxy = suv - (su * sv) / n;
      if (Math.abs(sxx) < 1e-15) return null;
      var B = sxy / sxx;
      var A = (sv - B * su) / n;
      var rVal = Math.abs(syy) < 1e-15 ? 1 : sxy / Math.sqrt(sxx * syy);
      return { A: A, B: B, r: rVal };
    }

    var a = 0, b = 0, c = undefined, r = undefined;
    var estY, estX;

    if (type === 'lin') {
      var lr = linRegTransformed(function (x) { return x; }, function (y) { return y; });
      if (!lr) return { error: 'Lỗi toán' };
      a = lr.A; b = lr.B; r = lr.r;
      if (Math.abs(a) < 1e-14) a = 0;
      if (Math.abs(b) < 1e-14) b = 0;
      estY = function (xVal) { return a + b * xVal; };
      estX = function (yVal) { return (yVal - a) / b; };
    } else if (type === 'quad') {
      if (n < 3) return { error: 'Lỗi toán' };
      var linSys = CalcEngine.solveLinear(
        [
          [n, sumx, sumx2],
          [sumx, sumx2, sumx3],
          [sumx2, sumx3, sumx4]
        ],
        [sumy, sumxy, sumx2y]
      );
      if (linSys.error) return { error: 'Lỗi toán' };
      a = linSys.solution[0];
      b = linSys.solution[1];
      c = linSys.solution[2];
      estY = function (xVal) { return a + b * xVal + c * xVal * xVal; };
      estX = function (yVal) {
        var pRes = CalcEngine.solvePoly([c, b, a - yVal]);
        if (!pRes.roots || pRes.roots.length === 0) return NaN;
        return pRes.roots[0].re;
      };
    } else if (type === 'log') {
      // y = a + b * ln(x)
      var lrLog = linRegTransformed(function (x) { return x > 0 ? Math.log(x) : NaN; }, function (y) { return y; });
      if (!lrLog) return { error: 'Lỗi toán' };
      a = lrLog.A; b = lrLog.B; r = lrLog.r;
      estY = function (xVal) { return a + b * Math.log(xVal); };
      estX = function (yVal) { return Math.exp((yVal - a) / b); };
    } else if (type === 'exp') {
      // y = a * e^(b*x) -> ln(y) = ln(a) + b*x
      var lrExp = linRegTransformed(function (x) { return x; }, function (y) { return y > 0 ? Math.log(y) : NaN; });
      if (!lrExp) return { error: 'Lỗi toán' };
      a = Math.exp(lrExp.A); b = lrExp.B; r = lrExp.r;
      estY = function (xVal) { return a * Math.exp(b * xVal); };
      estX = function (yVal) { return Math.log(yVal / a) / b; };
    } else if (type === 'abexp') {
      // y = a * b^x -> ln(y) = ln(a) + x * ln(b)
      var lrAb = linRegTransformed(function (x) { return x; }, function (y) { return y > 0 ? Math.log(y) : NaN; });
      if (!lrAb) return { error: 'Lỗi toán' };
      a = Math.exp(lrAb.A); b = Math.exp(lrAb.B); r = lrAb.r;
      estY = function (xVal) { return a * Math.pow(b, xVal); };
      estX = function (yVal) { return Math.log(yVal / a) / Math.log(b); };
    } else if (type === 'pow') {
      // y = a * x^b -> ln(y) = ln(a) + b * ln(x)
      var lrPow = linRegTransformed(function (x) { return x > 0 ? Math.log(x) : NaN; }, function (y) { return y > 0 ? Math.log(y) : NaN; });
      if (!lrPow) return { error: 'Lỗi toán' };
      a = Math.exp(lrPow.A); b = lrPow.B; r = lrPow.r;
      estY = function (xVal) { return a * Math.pow(xVal, b); };
      estX = function (yVal) { return Math.pow(yVal / a, 1 / b); };
    } else if (type === 'inv') {
      // y = a + b / x
      var lrInv = linRegTransformed(function (x) { return Math.abs(x) > 1e-15 ? 1 / x : NaN; }, function (y) { return y; });
      if (!lrInv) return { error: 'Lỗi toán' };
      a = lrInv.A; b = lrInv.B; r = lrInv.r;
      estY = function (xVal) { return a + b / xVal; };
      estX = function (yVal) { return b / (yVal - a); };
    } else {
      return { error: 'Lỗi cú pháp' };
    }

    var out = {
      n: n,
      a: a,
      b: b,
      meanx: meanx,
      meany: meany,
      sigmax: sigmax,
      sigmay: sigmay,
      sx: sx,
      sy: sy,
      sumx: sumx,
      sumy: sumy,
      sumxy: sumxy,
      sumx2: sumx2,
      sumy2: sumy2,
      estY: estY,
      estX: estX
    };
    if (c !== undefined) {
      out.c = c;
      out.sumx3 = sumx3;
      out.sumx4 = sumx4;
      out.sumx2y = sumx2y;
    }
    if (r !== undefined) out.r = r;
    return out;
  };

  // Tỉ lệ thức: type 1: A:B = X:D (a:b = X:c) -> X = a*c/b; type 2: A:B = C:X (a:b = c:X) -> X = b*c/a
  CalcEngine.ratio = function (type, a, b, c) {
    a = Number(a); b = Number(b); c = Number(c);
    if (!isNum(a) || !isNum(b) || !isNum(c)) return NaN;
    if (type === 1 || type === '1') {
      if (Math.abs(b) < 1e-15) return NaN;
      return (a * c) / b;
    }
    if (type === 2 || type === '2') {
      if (Math.abs(a) < 1e-15) return NaN;
      return (b * c) / a;
    }
    return NaN;
  };

  // ===========================================================================
  // GIAI ĐOẠN 2: SỐ PHỨC, CƠ SỐ N, MA TRẬN, VECTƠ, PHÂN PHỐI, BẢNG TÍNH,
  //              HỘP TOÁN HỌC, THUẬT TOÁN
  // ===========================================================================

  function cleanNum(v) {
    if (!isNum(v)) return v;
    if (Math.abs(v) < 1e-13) return 0;
    var r = Math.round(v);
    if (Math.abs(v - r) <= 1e-12 * Math.max(1, Math.abs(v))) return r;
    return v;
  }

  // ---------------------------------------------------------------------------
  // 1. SỐ PHỨC (CalcEngine.complex)
  // ---------------------------------------------------------------------------
  function cplx(re, im) {
    return { re: Number(re) || 0, im: Number(im) || 0 };
  }

  function cAdd(a, b) {
    return { re: a.re + b.re, im: a.im + b.im };
  }

  function cSub(a, b) {
    return { re: a.re - b.re, im: a.im - b.im };
  }

  function cMul(a, b) {
    return {
      re: a.re * b.re - a.im * b.im,
      im: a.re * b.im + a.im * b.re
    };
  }

  function cDiv(a, b) {
    var den = b.re * b.re + b.im * b.im;
    if (den < 1e-28) throw new Error('Lỗi toán');
    return {
      re: (a.re * b.re + a.im * b.im) / den,
      im: (a.im * b.re - a.re * b.im) / den
    };
  }

  function cAbs(a) {
    var x = Math.abs(a.re);
    var y = Math.abs(a.im);
    if (x === 0) return y;
    if (y === 0) return x;
    if (x > y) {
      var r1 = y / x;
      return x * Math.sqrt(1 + r1 * r1);
    }
    var r2 = x / y;
    return y * Math.sqrt(1 + r2 * r2);
  }

  function cSqrt(a) {
    if (Math.abs(a.im) < 1e-14) {
      if (a.re >= 0) return { re: Math.sqrt(a.re), im: 0 };
      return { re: 0, im: Math.sqrt(-a.re) };
    }
    var r = cAbs(a);
    var re = Math.sqrt(Math.max(0, (r + a.re) / 2));
    var im = (a.im >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, (r - a.re) / 2));
    return { re: re, im: im };
  }

  function cPow(base, exp) {
    // Số mũ nguyên: nhân lặp nhị phân để tránh sai số lượng giác
    if (Math.abs(exp.im) < 1e-13 && Math.abs(exp.re - Math.round(exp.re)) < 1e-11 && Math.abs(exp.re) <= 10000) {
      var n = Math.round(exp.re);
      if (n === 0) {
        if (Math.abs(base.re) < 1e-15 && Math.abs(base.im) < 1e-15) return { re: 1, im: 0 };
        return { re: 1, im: 0 };
      }
      var isNeg = n < 0;
      var k = Math.abs(n);
      var acc = { re: 1, im: 0 };
      var cur = { re: base.re, im: base.im };
      while (k > 0) {
        if (k % 2 === 1) acc = cMul(acc, cur);
        cur = cMul(cur, cur);
        k = Math.floor(k / 2);
      }
      if (isNeg) {
        acc = cDiv({ re: 1, im: 0 }, acc);
      }
      if (!isNum(acc.re) || !isNum(acc.im)) throw new Error('Lỗi toán');
      return acc;
    }

    var r = cAbs(base);
    if (r < 1e-15) {
      if (Math.abs(exp.im) < 1e-13 && exp.re > 0) return { re: 0, im: 0 };
      throw new Error('Lỗi toán');
    }
    if (Math.abs(base.im) < 1e-14 && base.re > 0 && Math.abs(exp.im) < 1e-14) {
      return { re: Math.pow(base.re, exp.re), im: 0 };
    }
    var lnR = Math.log(r);
    var theta = Math.atan2(base.im, base.re);
    // exp(exp * (lnR + i*theta))
    var pRe = exp.re * lnR - exp.im * theta;
    var pIm = exp.re * theta + exp.im * lnR;
    var mag = Math.exp(pRe);
    if (!isNum(mag)) throw new Error('Lỗi toán');
    return { re: mag * Math.cos(pIm), im: mag * Math.sin(pIm) };
  }

  // Chuỗi chính xác dạng đại số a+bi (không có dấu cách trước i: "1/2+√3/2i", "3-4i", "2i")
  function formatComplexRectExact(re, im, fmtOpts) {
    re = cleanNum(re);
    im = cleanNum(im);
    if (Math.abs(im) < 1e-11) {
      return CalcEngine.toExact(re) || CalcEngine.format(re, fmtOpts);
    }
    var absIm = Math.abs(im);
    var imEx = Math.abs(absIm - 1) < 1e-11 ? '' : (CalcEngine.toExact(absIm) || CalcEngine.format(absIm, fmtOpts));
    if (imEx.indexOf('+') !== -1 || imEx.indexOf('-', 1) !== -1) {
      imEx = '(' + imEx + ')';
    }
    var imUnit = imEx + 'i';
    if (Math.abs(re) < 1e-11) {
      return (im < 0 ? '-' : '') + imUnit;
    }
    var reEx = CalcEngine.toExact(re) || CalcEngine.format(re, fmtOpts);
    return reEx + (im < 0 ? '-' : '+') + imUnit;
  }

  function formatComplexRectDecimal(re, im, fmtOpts) {
    re = cleanNum(re);
    im = cleanNum(im);
    if (Math.abs(im) < 1e-11) {
      return CalcEngine.format(re, fmtOpts);
    }
    var absIm = Math.abs(im);
    var imDec = Math.abs(absIm - 1) < 1e-11 ? '' : CalcEngine.format(absIm, fmtOpts);
    var imUnit = imDec + 'i';
    if (Math.abs(re) < 1e-11) {
      return (im < 0 ? '-' : '') + imUnit;
    }
    var reDec = CalcEngine.format(re, fmtOpts);
    return reDec + (im < 0 ? '-' : '+') + imUnit;
  }

  function tokenizeComplex(text) {
    var tokens = [];
    var i = 0;
    var len = text.length;

    while (i < len) {
      var ch = text.charAt(i);
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        i++;
        continue;
      }

      // Hậu tố chuyển dạng ▶r∠θ hoặc ▶a+bi
      if (text.slice(i, i + 4) === '▶r∠θ') {
        tokens.push({ type: 'FORM_CAST', value: 'polar' });
        i += 4;
        continue;
      }
      if (text.slice(i, i + 4) === '▶a+bi' || text.slice(i, i + 5) === '▶a+bi') {
        tokens.push({ type: 'FORM_CAST', value: 'rect' });
        i += 5;
        continue;
      }

      // Toán tử góc cực ∠
      if (ch === '∠') {
        tokens.push({ type: 'OP', value: '∠' });
        i++;
        continue;
      }

      if (text.slice(i, i + 2) === '⁻¹') {
        tokens.push({ type: 'POSTFIX', value: '⁻¹' });
        i += 2;
        continue;
      }
      if (ch === '²' || ch === '³' || ch === '!' || ch === '%') {
        tokens.push({ type: 'POSTFIX', value: ch });
        i++;
        continue;
      }
      if (ch === '√') {
        tokens.push({ type: 'FUNC', value: 'sqrt' });
        i++;
        continue;
      }
      if (ch === '∛') {
        tokens.push({ type: 'FUNC', value: 'cbrt' });
        i++;
        continue;
      }
      if (ch === 'π') {
        tokens.push({ type: 'CONST', value: 'pi' });
        i++;
        continue;
      }
      if (ch === '⌟') {
        tokens.push({ type: 'OP', value: '⌟' });
        i++;
        continue;
      }
      if (ch === '+' || ch === '-' || ch === '−' || ch === '*' || ch === '×' || ch === '/' || ch === '÷' || ch === '^') {
        var opVal = ch;
        if (ch === '−') opVal = '-';
        else if (ch === '×') opVal = '*';
        else if (ch === '÷') opVal = '/';
        tokens.push({ type: 'OP', value: opVal });
        i++;
        continue;
      }
      if (ch === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue; }
      if (ch === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue; }
      if (ch === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue; }

      if ((ch >= '0' && ch <= '9') || ch === '.') {
        var numStr = '';
        var hasDot = false;
        while (i < len) {
          var c = text.charAt(i);
          if (c >= '0' && c <= '9') {
            numStr += c;
            i++;
          } else if (c === '.' && !hasDot) {
            hasDot = true;
            numStr += c;
            i++;
          } else if ((c === 'E' || c === 'e') && numStr.length > 0 && numStr !== '.') {
            var next1 = text.charAt(i + 1);
            var next2 = text.charAt(i + 2);
            var isSci = (next1 >= '0' && next1 <= '9') ||
                        ((next1 === '+' || next1 === '-' || next1 === '−') && (next2 >= '0' && next2 <= '9'));
            if (isSci && c === 'E') {
              numStr += 'e';
              i++;
              if (text.charAt(i) === '+' || text.charAt(i) === '-' || text.charAt(i) === '−') {
                numStr += (text.charAt(i) === '−' ? '-' : text.charAt(i));
                i++;
              }
              while (i < len && text.charAt(i) >= '0' && text.charAt(i) <= '9') {
                numStr += text.charAt(i);
                i++;
              }
            }
            break;
          } else {
            break;
          }
        }
        if (numStr === '.') throw new Error('Lỗi cú pháp');
        var pv = parseFloat(numStr);
        if (isNaN(pv)) throw new Error('Lỗi cú pháp');
        tokens.push({ type: 'NUM', value: pv });
        continue;
      }

      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '#') {
        var rest = text.slice(i);
        var kwList = [
          'PreAns', 'Ans', 'Conjg', 'conjg', 'conj', 'Arg', 'arg',
          'ReP', 'ImP', 're', 'im', 'Abs', 'abs',
          'asinh', 'acosh', 'atanh', 'asin', 'acos', 'atan',
          'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan',
          'sqrt', 'cbrt', 'root', 'log', 'ln', 'exp',
          'nPr', 'nCr', 'Pol', 'Rec', 'gcd', 'lcm',
          'intg', 'int', 'round', 'ranint', 'RanInt', 'ran#', 'Ran#', 'ran',
          'frac', 'mixed', 'dms', 'pi'
        ];
        var matchedKw = null;
        for (var kwIdx = 0; kwIdx < kwList.length; kwIdx++) {
          var kw = kwList[kwIdx];
          if (rest.slice(0, kw.length) === kw) {
            var afterCh = rest.charAt(kw.length);
            if (kw === 'int' && afterCh === 'g') continue;
            if (kw === 'ran' && (afterCh === 'i' || afterCh === '#')) continue;
            if ((kw === 're' || kw === 'im' || kw === 'arg' || kw === 'conj') &&
                ((afterCh >= 'a' && afterCh <= 'z') || (afterCh >= 'A' && afterCh <= 'Z'))) {
              continue;
            }
            matchedKw = kw;
            break;
          }
        }

        if (matchedKw) {
          i += matchedKw.length;
          var normKw = matchedKw;
          if (normKw === 'Conjg' || normKw === 'conjg') normKw = 'conj';
          else if (normKw === 'Arg') normKw = 'arg';
          else if (normKw === 'ReP') normKw = 're';
          else if (normKw === 'ImP') normKw = 'im';
          else if (normKw === 'Abs') normKw = 'abs';

          if (normKw === 'pi') tokens.push({ type: 'CONST', value: 'pi' });
          else if (normKw === 'Ans' || normKw === 'PreAns') tokens.push({ type: 'VAR', value: normKw });
          else if (normKw === 'nPr' || normKw === 'nCr') tokens.push({ type: 'COMB', value: normKw });
          else if (normKw === 'ran#' || normKw === 'Ran#') tokens.push({ type: 'CONST', value: 'ran#' });
          else if (normKw === 'RanInt') tokens.push({ type: 'FUNC', value: 'ranint' });
          else tokens.push({ type: 'FUNC', value: normKw });
          continue;
        }

        if (ch === 'i') {
          tokens.push({ type: 'CONST', value: 'i' });
          i++;
          continue;
        }
        if (ch === 'e') {
          tokens.push({ type: 'CONST', value: 'e' });
          i++;
          continue;
        }
        if (ch === 'P') {
          tokens.push({ type: 'COMB', value: 'nPr' });
          i++;
          continue;
        }
        if (ch === 'C') {
          var prevTok = tokens.length > 0 ? tokens[tokens.length - 1] : null;
          var nextRest = text.slice(i + 1).replace(/^\s+/, '');
          var nextCh = nextRest.charAt(0);
          var prevIsVal = prevTok && (prevTok.type === 'NUM' || prevTok.type === 'VAR' || prevTok.type === 'RPAREN' || prevTok.type === 'POSTFIX');
          var nextIsVal = (nextCh >= '0' && nextCh <= '9') || nextCh === '(' || nextCh === 'x' || nextCh === 'y' || (nextCh >= 'A' && nextCh <= 'F');
          if (prevIsVal && nextIsVal) tokens.push({ type: 'COMB', value: 'nCr' });
          else tokens.push({ type: 'VAR', value: 'C' });
          i++;
          continue;
        }
        if ('ABDEFxyM'.indexOf(ch) !== -1) {
          tokens.push({ type: 'VAR', value: ch });
          i++;
          continue;
        }

        throw new Error('Lỗi cú pháp');
      }

      throw new Error('Lỗi cú pháp');
    }

    return tokens;
  }

  function evalComplexTokens(tokens, opts) {
    var pos = 0;
    var angleMode = (opts && opts.angle) || 'deg';
    var vars = (opts && opts.vars) || {};
    var formOverride = null;

    function peek() { return pos < tokens.length ? tokens[pos] : null; }
    function consume() { return tokens[pos++]; }

    function requireReal(z) {
      if (Math.abs(z.im) > 1e-11) throw new Error('Lỗi toán');
      return z.re;
    }

    function canStartImplicitFactor(tok) {
      if (!tok) return false;
      return tok.type === 'NUM' || tok.type === 'CONST' || tok.type === 'VAR' ||
             tok.type === 'FUNC' || tok.type === 'LPAREN';
    }

    function parseAddSub() {
      var left = parseMulDiv();
      while (true) {
        var t = peek();
        if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
          consume();
          var right = parseMulDiv();
          if (t.value === '+') left = cAdd(left, right);
          else left = cSub(left, right);
        } else {
          break;
        }
      }
      return left;
    }

    function parseMulDiv() {
      var left = parseComb();
      while (true) {
        var t = peek();
        if (t && t.type === 'OP' && (t.value === '*' || t.value === '/')) {
          consume();
          var right = parseComb();
          if (t.value === '*') left = cMul(left, right);
          else left = cDiv(left, right);
        } else {
          break;
        }
      }
      return left;
    }

    function parseComb() {
      var left = parseUnary();
      while (true) {
        var t = peek();
        if (t && t.type === 'COMB') {
          consume();
          var right = parseUnary();
          var nL = requireReal(left);
          var nR = requireReal(right);
          var cVal = t.value === 'nPr' ? combP(nL, nR) : combC(nL, nR);
          left = cplx(cVal, 0);
        } else {
          break;
        }
      }
      return left;
    }

    function parseUnary() {
      var t = peek();
      if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
        consume();
        var v = parseUnary();
        return t.value === '-' ? cplx(-v.re, -v.im) : v;
      }
      return parseImplicit();
    }

    function parseImplicit() {
      var left = parsePolarOp();
      while (true) {
        var t = peek();
        if (canStartImplicitFactor(t)) {
          var right = parsePolarOp();
          left = cMul(left, right);
        } else {
          break;
        }
      }
      return left;
    }

    // Dạng cực r∠θ và phân số dòng a⌟b
    function parsePolarOp() {
      var first = parsePow();
      while (true) {
        var t = peek();
        if (t && t.type === 'OP' && t.value === '∠') {
          consume();
          var angZ = parseSignedPow();
          var rVal = requireReal(first);
          var thVal = requireReal(angZ);
          first = cplx(rVal * trigCos(thVal, angleMode), rVal * trigSin(thVal, angleMode));
        } else if (t && t.type === 'OP' && t.value === '⌟') {
          consume();
          var second = parsePow();
          var t2 = peek();
          if (t2 && t2.type === 'OP' && t2.value === '⌟') {
            consume();
            var third = parsePow();
            var r1 = requireReal(first), r2 = requireReal(second), r3 = requireReal(third);
            if (Math.abs(r3) < 1e-15) throw new Error('Lỗi toán');
            var sgn = r1 < 0 ? -1 : 1;
            first = cplx(sgn * (Math.abs(r1) + r2 / r3), 0);
          } else {
            first = cDiv(first, second);
          }
        } else {
          break;
        }
      }
      return first;
    }

    function parsePow() {
      var base = parsePostfix();
      var t = peek();
      if (t && t.type === 'OP' && t.value === '^') {
        consume();
        var exp = parseSignedPow();
        return cPow(base, exp);
      }
      return base;
    }

    function parseSignedPow() {
      var t = peek();
      if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
        consume();
        var v = parseSignedPow();
        return t.value === '-' ? cplx(-v.re, -v.im) : v;
      }
      return parsePow();
    }

    function parsePostfix() {
      var val = parseAtom();
      while (true) {
        var t = peek();
        if (t && t.type === 'POSTFIX') {
          consume();
          if (t.value === '!') {
            val = cplx(factorial(requireReal(val)), 0);
          } else if (t.value === '%') {
            val = cplx(val.re / 100, val.im / 100);
          } else if (t.value === '²') {
            val = cMul(val, val);
          } else if (t.value === '³') {
            val = cMul(cMul(val, val), val);
          } else if (t.value === '⁻¹') {
            val = cDiv(cplx(1, 0), val);
          }
        } else if (t && t.type === 'FORM_CAST') {
          consume();
          formOverride = t.value;
        } else {
          break;
        }
      }
      return val;
    }

    function parseAtom() {
      var t = peek();
      if (!t) throw new Error('Lỗi cú pháp');

      if (t.type === 'NUM') {
        consume();
        return cplx(t.value, 0);
      }
      if (t.type === 'CONST') {
        consume();
        if (t.value === 'i') return cplx(0, 1);
        if (t.value === 'pi') return cplx(Math.PI, 0);
        if (t.value === 'e') return cplx(Math.E, 0);
        if (t.value === 'ran#') return cplx(Math.round(Math.random() * 1000) / 1000, 0);
        throw new Error('Lỗi cú pháp');
      }
      if (t.type === 'VAR') {
        consume();
        var vObj = vars ? vars[t.value] : 0;
        if (vObj && typeof vObj === 'object' && isNum(vObj.re)) {
          return cplx(vObj.re, vObj.im || 0);
        }
        if (typeof vObj === 'number' && !isNaN(vObj)) {
          return cplx(vObj, 0);
        }
        return cplx(0, 0);
      }
      if (t.type === 'LPAREN') {
        consume();
        if (peek() && peek().type === 'RPAREN') throw new Error('Lỗi cú pháp');
        var inner = parseAddSub();
        var close = peek();
        if (close && close.type === 'RPAREN') {
          consume();
        } else if (pos < tokens.length) {
          throw new Error('Lỗi cú pháp');
        }
        return inner;
      }
      if (t.type === 'FUNC') {
        consume();
        return evalCplxFunc(t.value);
      }
      throw new Error('Lỗi cú pháp');
    }

    function evalCplxFunc(fn) {
      var args = [];
      var next = peek();
      if (next && next.type === 'LPAREN') {
        consume();
        if (peek() && peek().type === 'RPAREN') {
          consume();
        } else {
          while (true) {
            args.push(parseAddSub());
            var sep = peek();
            if (sep && sep.type === 'COMMA') {
              consume();
            } else if (sep && sep.type === 'RPAREN') {
              consume();
              break;
            } else if (!sep) {
              break;
            } else {
              throw new Error('Lỗi cú pháp');
            }
          }
        }
      } else {
        args.push(parseUnary());
      }

      if (fn === 'abs') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cplx(cAbs(args[0]), 0);
      }
      if (fn === 'arg') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        var zA = args[0];
        if (Math.abs(zA.re) < 1e-15 && Math.abs(zA.im) < 1e-15) throw new Error('Lỗi toán');
        return cplx(fromRad(Math.atan2(zA.im, zA.re), angleMode), 0);
      }
      if (fn === 'conj') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cplx(args[0].re, -args[0].im);
      }
      if (fn === 're') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cplx(args[0].re, 0);
      }
      if (fn === 'im') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cplx(args[0].im, 0);
      }
      if (fn === 'sqrt') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cSqrt(args[0]);
      }
      if (fn === 'frac') {
        if (args.length !== 2) throw new Error('Lỗi cú pháp');
        return cDiv(args[0], args[1]);
      }
      if (fn === 'mixed') {
        if (args.length !== 3) throw new Error('Lỗi cú pháp');
        var m0 = requireReal(args[0]), m1 = requireReal(args[1]), m2 = requireReal(args[2]);
        if (Math.abs(m2) < 1e-15) throw new Error('Lỗi toán');
        var sgn = m0 < 0 ? -1 : 1;
        return cplx(sgn * (Math.abs(m0) + m1 / m2), 0);
      }
      if (fn === 'exp') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        var zE = args[0];
        var ea = Math.exp(zE.re);
        return cplx(ea * Math.cos(zE.im), ea * Math.sin(zE.im));
      }
      if (fn === 'ln') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        var zL = args[0];
        var rL = cAbs(zL);
        if (rL < 1e-15) throw new Error('Lỗi toán');
        if (Math.abs(zL.im) < 1e-14 && zL.re > 0) return cplx(Math.log(zL.re), 0);
        return cplx(Math.log(rL), Math.atan2(zL.im, zL.re));
      }
      if (fn === 'sin') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cplx(trigSin(requireReal(args[0]), angleMode), 0);
      }
      if (fn === 'cos') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cplx(trigCos(requireReal(args[0]), angleMode), 0);
      }
      if (fn === 'tan') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cplx(trigTan(requireReal(args[0]), angleMode), 0);
      }
      if (fn === 'asin') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        var vAs = requireReal(args[0]);
        if (vAs < -1 - 1e-12 || vAs > 1 + 1e-12) throw new Error('Lỗi toán');
        return cplx(fromRad(Math.asin(Math.max(-1, Math.min(1, vAs))), angleMode), 0);
      }
      if (fn === 'acos') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        var vAc = requireReal(args[0]);
        if (vAc < -1 - 1e-12 || vAc > 1 + 1e-12) throw new Error('Lỗi toán');
        return cplx(fromRad(Math.acos(Math.max(-1, Math.min(1, vAc))), angleMode), 0);
      }
      if (fn === 'atan') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        return cplx(fromRad(Math.atan(requireReal(args[0])), angleMode), 0);
      }
      if (fn === 'cbrt') {
        if (args.length !== 1) throw new Error('Lỗi cú pháp');
        var xC = requireReal(args[0]);
        return cplx(xC < 0 ? -Math.pow(-xC, 1 / 3) : Math.pow(xC, 1 / 3), 0);
      }
      if (fn === 'root') {
        if (args.length !== 2) throw new Error('Lỗi cú pháp');
        var nR = requireReal(args[0]), xR = requireReal(args[1]);
        if (Math.abs(nR) < 1e-15) throw new Error('Lỗi toán');
        return cPow(cplx(xR, 0), cplx(1 / nR, 0));
      }
      if (fn === 'log') {
        if (args.length === 1) {
          var vLg = requireReal(args[0]);
          if (vLg <= 0) throw new Error('Lỗi toán');
          return cplx(Math.log(vLg) / Math.LN10, 0);
        }
        if (args.length === 2) {
          var bLg = requireReal(args[0]), xLg = requireReal(args[1]);
          if (bLg <= 0 || Math.abs(bLg - 1) < 1e-15 || xLg <= 0) throw new Error('Lỗi toán');
          return cplx(Math.log(xLg) / Math.log(bLg), 0);
        }
        throw new Error('Lỗi cú pháp');
      }
      if (fn === 'dms') {
        if (args.length < 1 || args.length > 3) throw new Error('Lỗi cú pháp');
        var d0 = requireReal(args[0] || cplx(0, 0));
        var d1 = args[1] ? requireReal(args[1]) : 0;
        var d2 = args[2] ? requireReal(args[2]) : 0;
        var sgnD = d0 < 0 ? -1 : 1;
        return cplx(sgnD * (Math.abs(d0) + d1 / 60 + d2 / 3600), 0);
      }
      throw new Error('Lỗi cú pháp');
    }

    var res = parseAddSub();
    if (pos < tokens.length) throw new Error('Lỗi cú pháp');
    if (!isNum(res.re) || !isNum(res.im)) throw new Error('Lỗi toán');
    return { re: cleanNum(res.re), im: cleanNum(res.im), formOverride: formOverride };
  }

  function evalComplex(text, opts) {
    opts = opts || {};
    if (typeof text !== 'string') return { ok: false, error: 'Lỗi cú pháp' };
    var trimmed = text.replace(/^\s+|\s+$/g, '');
    if (!trimmed) return { ok: false, error: 'Lỗi cú pháp' };

    try {
      var normText = trimmed
        .replace(/(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°?/g, 'dms($1,$2,$3)')
        .replace(/(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)°/g, 'dms($1,$2,0)')
        .replace(/(\d+(?:\.\d+)?)°/g, '$1');

      var tokens = tokenizeComplex(normText);
      if (tokens.length === 0) return { ok: false, error: 'Lỗi cú pháp' };
      var ev = evalComplexTokens(tokens, opts);
      var re = ev.re;
      var im = ev.im;
      var angleMode = opts.angle || 'deg';
      var fmtOpts = opts.format;

      var r = cleanNum(cAbs({ re: re, im: im }));
      var theta = r < 1e-13 ? 0 : cleanNum(fromRad(Math.atan2(im, re), angleMode));
      var rEx = CalcEngine.toExact(r) || CalcEngine.format(r, fmtOpts);
      var thEx = CalcEngine.toExact(theta) || CalcEngine.format(theta, fmtOpts);
      var polarExact = rEx + '∠' + thEx;
      var polarDec = CalcEngine.format(r, fmtOpts) + '∠' + CalcEngine.format(theta, fmtOpts);

      var rectExact = formatComplexRectExact(re, im, fmtOpts);
      var rectDec = formatComplexRectDecimal(re, im, fmtOpts);
      var form = ev.formOverride || opts.form || 'rect';

      return {
        ok: true,
        re: re,
        im: im,
        value: re,
        exact: form === 'polar' ? polarExact : rectExact,
        rectExact: rectExact,
        decimal: form === 'polar' ? polarDec : rectDec,
        rectDecimal: rectDec,
        polar: {
          r: r,
          theta: theta,
          exact: polarExact,
          decimal: polarDec
        }
      };
    } catch (e) {
      var msg = (e && e.message) ? e.message : 'Lỗi toán';
      if (msg !== 'Lỗi toán' && msg !== 'Lỗi cú pháp') msg = 'Lỗi toán';
      return { ok: false, error: msg };
    }
  }

  CalcEngine.complex = function (text, opts) {
    return evalComplex(text, opts);
  };
  CalcEngine.complex.evalComplex = evalComplex;
  CalcEngine.evalComplex = evalComplex;

  // ---------------------------------------------------------------------------
  // 2. CƠ SỐ N (CalcEngine.baseN) — Số nguyên 32-bit bù 2
  // ---------------------------------------------------------------------------
  var INT32_MIN = -2147483648;
  var INT32_MAX = 2147483647;
  var UINT32_MAX = 4294967295;

  function formatBase32(val, base) {
    val = val | 0;
    if (base === 10) return String(val);
    if (val === 0) return '0';
    var u = val >>> 0;
    return u.toString(base).toUpperCase();
  }

  function parseBaseLiteral(digits, b) {
    if (!digits || digits.length === 0) throw new Error('Lỗi cú pháp');
    var acc = 0;
    for (var i = 0; i < digits.length; i++) {
      var c = digits.charAt(i);
      var dv = -1;
      if (c >= '0' && c <= '9') dv = c.charCodeAt(0) - 48;
      else if (c >= 'A' && c <= 'F') dv = c.charCodeAt(0) - 55;
      else if (c >= 'a' && c <= 'f') dv = c.charCodeAt(0) - 87;
      if (dv < 0 || dv >= b) throw new Error('Lỗi cú pháp');
      acc = acc * b + dv;
      if (b === 10) {
        // Cho phép tối đa 2147483648 để xử lý -2147483648
        if (acc > 2147483648) throw new Error('Lỗi toán');
      } else {
        if (acc > UINT32_MAX) throw new Error('Lỗi toán');
      }
    }
    return { raw: acc, base: b };
  }

  function tokenizeBaseN(text, defaultBase) {
    var tokens = [];
    var i = 0;
    var len = text.length;

    while (i < len) {
      var ch = text.charAt(i);
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        i++;
        continue;
      }
      if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
      if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
      if (ch === '+' || ch === '-' || ch === '−' || ch === '*' || ch === '×' || ch === '/' || ch === '÷') {
        var op = ch;
        if (ch === '−') op = '-';
        else if (ch === '×') op = '*';
        else if (ch === '÷') op = '/';
        tokens.push({ type: 'OP', value: op });
        i++;
        continue;
      }

      var rest = text.slice(i);
      // Từ khóa logic bit: xnor, xor, and, or, not, neg (không phân biệt hoa thường nếu đứng riêng)
      var kwMatch = rest.match(/^(xnor|xor|and|or|not|neg)(?![0-9A-Za-z])/i);
      if (kwMatch) {
        var kw = kwMatch[1].toLowerCase();
        tokens.push({ type: (kw === 'not' || kw === 'neg') ? 'UNARY' : 'BITOP', value: kw });
        i += kwMatch[1].length;
        continue;
      }

      // Kiểm tra tiền tố cơ số d, h, b, o (viết thường) theo sau bởi chữ số hợp lệ
      if (ch === 'd' || ch === 'h' || ch === 'b' || ch === 'o') {
        var prefBase = ch === 'd' ? 10 : (ch === 'h' ? 16 : (ch === 'b' ? 2 : 8));
        var j = i + 1;
        var numDigits = '';
        while (j < len) {
          var cj = text.charAt(j);
          if ((cj >= '0' && cj <= '9') || (cj >= 'A' && cj <= 'F') || (cj >= 'a' && cj <= 'f')) {
            numDigits += cj;
            j++;
          } else {
            break;
          }
        }
        if (numDigits.length > 0) {
          tokens.push({ type: 'NUM', lit: parseBaseLiteral(numDigits, prefBase) });
          i = j;
          continue;
        }
      }

      // Số trong cơ số hiện hành (chữ số 0-9, A-F, a-f)
      if ((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'F') || (ch >= 'a' && ch <= 'f')) {
        var k = i;
        var dStr = '';
        while (k < len) {
          var ck = text.charAt(k);
          if ((ck >= '0' && ck <= '9') || (ck >= 'A' && ck <= 'F') || (ck >= 'a' && ck <= 'f')) {
            dStr += ck;
            k++;
          } else {
            break;
          }
        }
        tokens.push({ type: 'NUM', lit: parseBaseLiteral(dStr, defaultBase) });
        i = k;
        continue;
      }

      throw new Error('Lỗi cú pháp');
    }
    return tokens;
  }

  function checkInt32(v) {
    if (!isNum(v) || v < INT32_MIN || v > INT32_MAX) {
      throw new Error('Lỗi toán');
    }
    return v | 0;
  }

  function litToInt32(lit, isNegated) {
    if (lit.base === 10) {
      if (isNegated) {
        if (lit.raw > 2147483648) throw new Error('Lỗi toán');
        return (-lit.raw) | 0;
      }
      if (lit.raw > INT32_MAX) throw new Error('Lỗi toán');
      return lit.raw | 0;
    }
    // Ở cơ số 2, 8, 16: số 32 bit không dấu chuyển sang bù 2 có dấu
    var val = lit.raw | 0;
    if (isNegated) {
      if (val === INT32_MIN) throw new Error('Lỗi toán');
      return (-val) | 0;
    }
    return val;
  }

  CalcEngine.baseN = function (text, base) {
    base = Number(base || 10);
    if (base !== 2 && base !== 8 && base !== 10 && base !== 16) {
      return { ok: false, error: 'Lỗi cú pháp' };
    }
    if (typeof text !== 'string') {
      return { ok: false, error: 'Lỗi cú pháp' };
    }
    var trimmed = text.replace(/^\s+|\s+$/g, '');
    if (!trimmed) {
      return { ok: false, error: 'Lỗi cú pháp' };
    }

    try {
      var tokens = tokenizeBaseN(trimmed, base);
      if (tokens.length === 0) return { ok: false, error: 'Lỗi cú pháp' };
      var pos = 0;

      function peek() { return pos < tokens.length ? tokens[pos] : null; }
      function consume() { return tokens[pos++]; }

      // Thứ tự ưu tiên: or -> xor/xnor -> and -> +/- -> */ -> unary (+, -, not, neg) -> atom
      function parseOr() {
        var left = parseXor();
        while (true) {
          var t = peek();
          if (t && t.type === 'BITOP' && t.value === 'or') {
            consume();
            var right = parseXor();
            left = (left | right) | 0;
          } else {
            break;
          }
        }
        return left;
      }

      function parseXor() {
        var left = parseAnd();
        while (true) {
          var t = peek();
          if (t && t.type === 'BITOP' && (t.value === 'xor' || t.value === 'xnor')) {
            consume();
            var right = parseAnd();
            if (t.value === 'xor') left = (left ^ right) | 0;
            else left = (~(left ^ right)) | 0;
          } else {
            break;
          }
        }
        return left;
      }

      function parseAnd() {
        var left = parseAddSub();
        while (true) {
          var t = peek();
          if (t && t.type === 'BITOP' && t.value === 'and') {
            consume();
            var right = parseAddSub();
            left = (left & right) | 0;
          } else {
            break;
          }
        }
        return left;
      }

      function parseAddSub() {
        var left = parseMulDiv();
        while (true) {
          var t = peek();
          if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
            consume();
            var right = parseMulDiv();
            var res = t.value === '+' ? (left + right) : (left - right);
            left = checkInt32(res);
          } else {
            break;
          }
        }
        return left;
      }

      function parseMulDiv() {
        var left = parseUnary();
        while (true) {
          var t = peek();
          if (t && t.type === 'OP' && (t.value === '*' || t.value === '/')) {
            consume();
            var right = parseUnary();
            if (t.value === '*') {
              left = checkInt32(left * right);
            } else {
              if (right === 0) throw new Error('Lỗi toán');
              var q = (left / right);
              q = q < 0 ? Math.ceil(q) : Math.floor(q);
              left = checkInt32(q);
            }
          } else {
            break;
          }
        }
        return left;
      }

      function parseUnary() {
        var t = peek();
        if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
          consume();
          if (t.value === '-') {
            var nextT = peek();
            if (nextT && nextT.type === 'NUM') {
              consume();
              return litToInt32(nextT.lit, true);
            }
            var v = parseUnary();
            return checkInt32(-v);
          }
          return parseUnary();
        }
        if (t && t.type === 'UNARY') {
          consume();
          var arg = parseUnary();
          if (t.value === 'not') return (~arg) | 0;
          return checkInt32(-arg);
        }
        return parseAtom();
      }

      function parseAtom() {
        var t = peek();
        if (!t) throw new Error('Lỗi cú pháp');
        if (t.type === 'NUM') {
          consume();
          return litToInt32(t.lit, false);
        }
        if (t.type === 'LPAREN') {
          consume();
          var inner = parseOr();
          var cl = peek();
          if (cl && cl.type === 'RPAREN') consume();
          else if (pos < tokens.length) throw new Error('Lỗi cú pháp');
          return inner;
        }
        throw new Error('Lỗi cú pháp');
      }

      var val = parseOr();
      if (pos < tokens.length) throw new Error('Lỗi cú pháp');

      return {
        ok: true,
        value: val,
        display: formatBase32(val, base),
        allBases: {
          dec: formatBase32(val, 10),
          hex: formatBase32(val, 16),
          bin: formatBase32(val, 2),
          oct: formatBase32(val, 8)
        }
      };
    } catch (e) {
      var msg = (e && e.message) ? e.message : 'Lỗi toán';
      if (msg !== 'Lỗi toán' && msg !== 'Lỗi cú pháp') msg = 'Lỗi toán';
      return { ok: false, error: msg };
    }
  };

  // ---------------------------------------------------------------------------
  // 3. MA TRẬN (CalcEngine.matrix) — Kích thước tới 4×4
  // ---------------------------------------------------------------------------
  function getMatrixDims(A) {
    if (!Array.isArray(A) || A.length < 1 || A.length > 4) return null;
    var m = A.length;
    if (!Array.isArray(A[0]) || A[0].length < 1 || A[0].length > 4) return null;
    var n = A[0].length;
    for (var i = 0; i < m; i++) {
      if (!Array.isArray(A[i]) || A[i].length !== n) return null;
      for (var j = 0; j < n; j++) {
        if (!isNum(Number(A[i][j]))) return null;
      }
    }
    return { m: m, n: n };
  }

  function cloneMat(A) {
    var out = [];
    for (var i = 0; i < A.length; i++) {
      var row = [];
      for (var j = 0; j < A[i].length; j++) {
        row.push(cleanNum(Number(A[i][j])));
      }
      out.push(row);
    }
    return out;
  }

  var MatrixAPI = {
    identity: function (n) {
      n = Number(n);
      if (!isNum(n) || n < 1 || n > 4 || Math.abs(n - Math.round(n)) > 1e-9) {
        return { error: 'Lỗi kích thước' };
      }
      n = Math.round(n);
      var I = [];
      for (var i = 0; i < n; i++) {
        var row = [];
        for (var j = 0; j < n; j++) row.push(i === j ? 1 : 0);
        I.push(row);
      }
      return I;
    },

    add: function (A, B) {
      var dA = getMatrixDims(A), dB = getMatrixDims(B);
      if (!dA || !dB || dA.m !== dB.m || dA.n !== dB.n) {
        return { error: 'Lỗi kích thước' };
      }
      var C = [];
      for (var i = 0; i < dA.m; i++) {
        var row = [];
        for (var j = 0; j < dA.n; j++) {
          row.push(cleanNum(Number(A[i][j]) + Number(B[i][j])));
        }
        C.push(row);
      }
      return C;
    },

    sub: function (A, B) {
      var dA = getMatrixDims(A), dB = getMatrixDims(B);
      if (!dA || !dB || dA.m !== dB.m || dA.n !== dB.n) {
        return { error: 'Lỗi kích thước' };
      }
      var C = [];
      for (var i = 0; i < dA.m; i++) {
        var row = [];
        for (var j = 0; j < dA.n; j++) {
          row.push(cleanNum(Number(A[i][j]) - Number(B[i][j])));
        }
        C.push(row);
      }
      return C;
    },

    scale: function (k, A) {
      if (Array.isArray(k) && typeof A === 'number') {
        var tmp = k; k = A; A = tmp;
      }
      k = Number(k);
      var dA = getMatrixDims(A);
      if (!isNum(k) || !dA) return { error: 'Lỗi kích thước' };
      var C = [];
      for (var i = 0; i < dA.m; i++) {
        var row = [];
        for (var j = 0; j < dA.n; j++) {
          row.push(cleanNum(k * Number(A[i][j])));
        }
        C.push(row);
      }
      return C;
    },

    mul: function (A, B) {
      if (typeof A === 'number') return MatrixAPI.scale(A, B);
      if (typeof B === 'number') return MatrixAPI.scale(B, A);
      var dA = getMatrixDims(A), dB = getMatrixDims(B);
      if (!dA || !dB || dA.n !== dB.m) {
        return { error: 'Lỗi kích thước' };
      }
      var C = [];
      for (var i = 0; i < dA.m; i++) {
        var row = [];
        for (var j = 0; j < dB.n; j++) {
          var sum = 0;
          for (var k = 0; k < dA.n; k++) {
            sum += Number(A[i][k]) * Number(B[k][j]);
          }
          row.push(cleanNum(sum));
        }
        C.push(row);
      }
      return C;
    },

    trn: function (A) {
      var dA = getMatrixDims(A);
      if (!dA) return { error: 'Lỗi kích thước' };
      var T = [];
      for (var j = 0; j < dA.n; j++) {
        var row = [];
        for (var i = 0; i < dA.m; i++) {
          row.push(cleanNum(Number(A[i][j])));
        }
        T.push(row);
      }
      return T;
    },

    det: function (A) {
      var dA = getMatrixDims(A);
      if (!dA || dA.m !== dA.n) return { error: 'Lỗi kích thước' };
      var n = dA.m;
      var M = cloneMat(A);
      var sign = 1;
      for (var col = 0; col < n; col++) {
        var maxRow = col;
        var maxVal = Math.abs(M[col][col]);
        for (var r = col + 1; r < n; r++) {
          if (Math.abs(M[r][col]) > maxVal) {
            maxVal = Math.abs(M[r][col]);
            maxRow = r;
          }
        }
        if (maxVal < 1e-13) return 0;
        if (maxRow !== col) {
          var tmp = M[col]; M[col] = M[maxRow]; M[maxRow] = tmp;
          sign = -sign;
        }
        var piv = M[col][col];
        for (var r2 = col + 1; r2 < n; r2++) {
          var f = M[r2][col] / piv;
          for (var c2 = col; c2 < n; c2++) {
            M[r2][c2] -= f * M[col][c2];
          }
        }
      }
      var prod = sign;
      for (var i = 0; i < n; i++) prod *= M[i][i];
      return cleanNum(prod);
    },

    inv: function (A) {
      var dA = getMatrixDims(A);
      if (!dA || dA.m !== dA.n) return { error: 'Lỗi kích thước' };
      var n = dA.m;
      var aug = [];
      for (var i = 0; i < n; i++) {
        var row = [];
        for (var j = 0; j < n; j++) row.push(Number(A[i][j]));
        for (var k = 0; k < n; k++) row.push(i === k ? 1 : 0);
        aug.push(row);
      }

      for (var col = 0; col < n; col++) {
        var maxRow = col;
        var maxVal = Math.abs(aug[col][col]);
        for (var r = col + 1; r < n; r++) {
          if (Math.abs(aug[r][col]) > maxVal) {
            maxVal = Math.abs(aug[r][col]);
            maxRow = r;
          }
        }
        if (maxVal < 1e-12) return { error: 'Lỗi toán' };
        if (maxRow !== col) {
          var tmp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = tmp;
        }
        var piv = aug[col][col];
        for (var c = 0; c < 2 * n; c++) aug[col][c] /= piv;
        for (var r2 = 0; r2 < n; r2++) {
          if (r2 === col) continue;
          var factor = aug[r2][col];
          if (Math.abs(factor) > 1e-15) {
            for (var c2 = 0; c2 < 2 * n; c2++) {
              aug[r2][c2] -= factor * aug[col][c2];
            }
          }
        }
      }

      var invM = [];
      for (var r3 = 0; r3 < n; r3++) {
        var iRow = [];
        for (var c3 = 0; c3 < n; c3++) {
          iRow.push(cleanNum(aug[r3][n + c3]));
        }
        invM.push(iRow);
      }
      return invM;
    },

    pow: function (A, n) {
      var dA = getMatrixDims(A);
      if (!dA || dA.m !== dA.n) return { error: 'Lỗi kích thước' };
      n = Number(n);
      if (!isNum(n) || Math.abs(n - Math.round(n)) > 1e-9) return { error: 'Lỗi toán' };
      n = Math.round(n);
      if (n === 0) return MatrixAPI.identity(dA.m);
      var cur = cloneMat(A);
      if (n < 0) {
        cur = MatrixAPI.inv(cur);
        if (cur.error) return cur;
        n = -n;
      }
      var res = MatrixAPI.identity(dA.m);
      while (n > 0) {
        if (n % 2 === 1) res = MatrixAPI.mul(res, cur);
        cur = MatrixAPI.mul(cur, cur);
        n = Math.floor(n / 2);
      }
      return res;
    },

    ref: function (A) {
      var dA = getMatrixDims(A);
      if (!dA) return { error: 'Lỗi kích thước' };
      var M = cloneMat(A);
      var m = dA.m, n = dA.n;
      var r = 0;
      for (var c = 0; c < n && r < m; c++) {
        var maxR = r;
        var maxV = Math.abs(M[r][c]);
        for (var i = r + 1; i < m; i++) {
          if (Math.abs(M[i][c]) > maxV) {
            maxV = Math.abs(M[i][c]);
            maxR = i;
          }
        }
        if (maxV < 1e-12) continue;
        if (maxR !== r) {
          var tmp = M[r]; M[r] = M[maxR]; M[maxR] = tmp;
        }
        var piv = M[r][c];
        for (var j = c; j < n; j++) M[r][j] = cleanNum(M[r][j] / piv);
        for (var i2 = r + 1; i2 < m; i2++) {
          var f = M[i2][c];
          if (Math.abs(f) > 1e-15) {
            for (var j2 = c; j2 < n; j2++) {
              M[i2][j2] = cleanNum(M[i2][j2] - f * M[r][j2]);
            }
          }
        }
        r++;
      }
      return M;
    },

    rref: function (A) {
      var dA = getMatrixDims(A);
      if (!dA) return { error: 'Lỗi kích thước' };
      var M = cloneMat(A);
      var m = dA.m, n = dA.n;
      var r = 0;
      for (var c = 0; c < n && r < m; c++) {
        var maxR = r;
        var maxV = Math.abs(M[r][c]);
        for (var i = r + 1; i < m; i++) {
          if (Math.abs(M[i][c]) > maxV) {
            maxV = Math.abs(M[i][c]);
            maxR = i;
          }
        }
        if (maxV < 1e-12) continue;
        if (maxR !== r) {
          var tmp = M[r]; M[r] = M[maxR]; M[maxR] = tmp;
        }
        var piv = M[r][c];
        for (var j = c; j < n; j++) M[r][j] = cleanNum(M[r][j] / piv);
        for (var i2 = 0; i2 < m; i2++) {
          if (i2 === r) continue;
          var f = M[i2][c];
          if (Math.abs(f) > 1e-15) {
            for (var j2 = c; j2 < n; j2++) {
              M[i2][j2] = cleanNum(M[i2][j2] - f * M[r][j2]);
            }
          }
        }
        r++;
      }
      return M;
    },

    // Đánh giá biểu thức ma trận (dùng cho ứng dụng Ma trận trên giao diện)
    evalExpr: function (text, mats) {
      if (typeof text !== 'string' || !text.replace(/\s+/g, '')) {
        return { error: 'Lỗi cú pháp' };
      }
      mats = mats || {};
      var toks = [];
      var i = 0;
      var s = text.replace(/^\s+|\s+$/g, '');
      while (i < s.length) {
        var ch = s.charAt(i);
        if (ch === ' ' || ch === '\t') { i++; continue; }
        if (s.slice(i, i + 2) === '⁻¹') { toks.push({ type: 'POST', value: -1 }); i += 2; continue; }
        if (ch === '²') { toks.push({ type: 'POST', value: 2 }); i++; continue; }
        if (ch === '³') { toks.push({ type: 'POST', value: 3 }); i++; continue; }
        if (ch === '+' || ch === '-' || ch === '−' || ch === '*' || ch === '×' || ch === '/' || ch === '÷' || ch === '^') {
          var op = ch === '−' ? '-' : (ch === '×' ? '*' : (ch === '÷' ? '/' : ch));
          toks.push({ type: 'OP', value: op });
          i++;
          continue;
        }
        if (ch === '(') { toks.push({ type: 'LP' }); i++; continue; }
        if (ch === ')') { toks.push({ type: 'RP' }); i++; continue; }
        if ((ch >= '0' && ch <= '9') || ch === '.') {
          var nStr = '';
          while (i < s.length && ((s.charAt(i) >= '0' && s.charAt(i) <= '9') || s.charAt(i) === '.')) {
            nStr += s.charAt(i++);
          }
          toks.push({ type: 'NUM', value: parseFloat(nStr) });
          continue;
        }
        var rest = s.slice(i);
        var mVar = rest.match(/^(MatAns|MatA|MatB|MatC|MatD)/);
        if (mVar) {
          toks.push({ type: 'MAT', name: mVar[1] });
          i += mVar[1].length;
          continue;
        }
        var mFn = rest.match(/^(Identity|identity|Rref|rref|Ref|ref|Trn|trn|Det|det|Inv|inv)/);
        if (mFn) {
          toks.push({ type: 'FN', name: mFn[1].toLowerCase() });
          i += mFn[1].length;
          continue;
        }
        return { error: 'Lỗi cú pháp' };
      }

      var pos = 0;
      function peek() { return pos < toks.length ? toks[pos] : null; }
      function consume() { return toks[pos++]; }

      function unwrap(v) {
        if (v && typeof v === 'object' && v.error) throw new Error(v.error);
        return v;
      }

      function parseAdd() {
        var left = parseMul();
        while (true) {
          var t = peek();
          if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
            consume();
            var right = parseMul();
            if (typeof left === 'number' && typeof right === 'number') {
              left = t.value === '+' ? (left + right) : (left - right);
            } else if (Array.isArray(left) && Array.isArray(right)) {
              left = unwrap(t.value === '+' ? MatrixAPI.add(left, right) : MatrixAPI.sub(left, right));
            } else {
              throw new Error('Lỗi kích thước');
            }
          } else break;
        }
        return left;
      }

      function parseMul() {
        var left = parseUnary();
        while (true) {
          var t = peek();
          if (t && t.type === 'OP' && (t.value === '*' || t.value === '/')) {
            consume();
            var right = parseUnary();
            if (t.value === '*') {
              if (typeof left === 'number' && typeof right === 'number') left = left * right;
              else left = unwrap(MatrixAPI.mul(left, right));
            } else {
              if (typeof right !== 'number' || Math.abs(right) < 1e-15) throw new Error('Lỗi toán');
              if (typeof left === 'number') left = left / right;
              else left = unwrap(MatrixAPI.scale(1 / right, left));
            }
          } else if (t && (t.type === 'MAT' || t.type === 'FN' || t.type === 'LP')) {
            var rImp = parseUnary();
            if (typeof left === 'number' && typeof rImp === 'number') left = left * rImp;
            else left = unwrap(MatrixAPI.mul(left, rImp));
          } else break;
        }
        return left;
      }

      function parseUnary() {
        var t = peek();
        if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
          consume();
          var v = parseUnary();
          if (t.value === '-') {
            return typeof v === 'number' ? -v : unwrap(MatrixAPI.scale(-1, v));
          }
          return v;
        }
        return parsePow();
      }

      function parsePow() {
        var base = parsePost();
        var t = peek();
        if (t && t.type === 'OP' && t.value === '^') {
          consume();
          var exp = parseUnary();
          if (typeof exp !== 'number') throw new Error('Lỗi toán');
          if (typeof base === 'number') return Math.pow(base, exp);
          return unwrap(MatrixAPI.pow(base, exp));
        }
        return base;
      }

      function parsePost() {
        var v = parseAtom();
        while (true) {
          var t = peek();
          if (t && t.type === 'POST') {
            consume();
            if (typeof v === 'number') v = Math.pow(v, t.value);
            else v = unwrap(MatrixAPI.pow(v, t.value));
          } else break;
        }
        return v;
      }

      function parseAtom() {
        var t = peek();
        if (!t) throw new Error('Lỗi cú pháp');
        if (t.type === 'NUM') { consume(); return t.value; }
        if (t.type === 'MAT') {
          consume();
          var m = mats[t.name];
          if (!m) throw new Error('Lỗi kích thước');
          return cloneMat(m);
        }
        if (t.type === 'LP') {
          consume();
          var val = parseAdd();
          if (peek() && peek().type === 'RP') consume();
          return val;
        }
        if (t.type === 'FN') {
          consume();
          if (peek() && peek().type === 'LP') consume();
          var arg = parseAdd();
          if (peek() && peek().type === 'RP') consume();
          if (t.name === 'det') return unwrap(MatrixAPI.det(arg));
          if (t.name === 'trn') return unwrap(MatrixAPI.trn(arg));
          if (t.name === 'inv') return unwrap(MatrixAPI.inv(arg));
          if (t.name === 'ref') return unwrap(MatrixAPI.ref(arg));
          if (t.name === 'rref') return unwrap(MatrixAPI.rref(arg));
          if (t.name === 'identity') return unwrap(MatrixAPI.identity(arg));
        }
        throw new Error('Lỗi cú pháp');
      }

      try {
        var out = parseAdd();
        if (pos < toks.length) return { error: 'Lỗi cú pháp' };
        return { ok: true, result: out };
      } catch (e) {
        return { error: (e && e.message) || 'Lỗi toán' };
      }
    }
  };

  CalcEngine.matrix = MatrixAPI;

  // ---------------------------------------------------------------------------
  // 4. VECTƠ (CalcEngine.vector) — 2D hoặc 3D
  // ---------------------------------------------------------------------------
  function checkVec(u) {
    if (!Array.isArray(u) || (u.length !== 2 && u.length !== 3)) return false;
    for (var i = 0; i < u.length; i++) {
      if (!isNum(Number(u[i]))) return false;
    }
    return true;
  }

  var VectorAPI = {
    add: function (u, v) {
      if (!checkVec(u) || !checkVec(v) || u.length !== v.length) {
        return { error: 'Lỗi kích thước' };
      }
      var res = [];
      for (var i = 0; i < u.length; i++) res.push(cleanNum(Number(u[i]) + Number(v[i])));
      return res;
    },

    sub: function (u, v) {
      if (!checkVec(u) || !checkVec(v) || u.length !== v.length) {
        return { error: 'Lỗi kích thước' };
      }
      var res = [];
      for (var i = 0; i < u.length; i++) res.push(cleanNum(Number(u[i]) - Number(v[i])));
      return res;
    },

    scale: function (k, u) {
      if (Array.isArray(k) && typeof u === 'number') {
        var tmp = k; k = u; u = tmp;
      }
      k = Number(k);
      if (!isNum(k) || !checkVec(u)) return { error: 'Lỗi kích thước' };
      var res = [];
      for (var i = 0; i < u.length; i++) res.push(cleanNum(k * Number(u[i])));
      return res;
    },

    dot: function (u, v) {
      if (!checkVec(u) || !checkVec(v) || u.length !== v.length) {
        return { error: 'Lỗi kích thước' };
      }
      var s = 0;
      for (var i = 0; i < u.length; i++) s += Number(u[i]) * Number(v[i]);
      return cleanNum(s);
    },

    cross: function (u, v) {
      if (!checkVec(u) || !checkVec(v)) {
        return { error: 'Lỗi kích thước' };
      }
      var u0 = Number(u[0]), u1 = Number(u[1]), u2 = u.length === 3 ? Number(u[2]) : 0;
      var v0 = Number(v[0]), v1 = Number(v[1]), v2 = v.length === 3 ? Number(v[2]) : 0;
      return [
        cleanNum(u1 * v2 - u2 * v1),
        cleanNum(u2 * v0 - u0 * v2),
        cleanNum(u0 * v1 - u1 * v0)
      ];
    },

    norm: function (u) {
      if (!checkVec(u)) return { error: 'Lỗi kích thước' };
      var s = 0;
      for (var i = 0; i < u.length; i++) {
        var x = Number(u[i]);
        s += x * x;
      }
      return cleanNum(Math.sqrt(s));
    },

    angle: function (u, v, optsOrAngle) {
      if (!checkVec(u) || !checkVec(v) || u.length !== v.length) {
        return { error: 'Lỗi kích thước' };
      }
      var nu = VectorAPI.norm(u);
      var nv = VectorAPI.norm(v);
      if (nu < 1e-15 || nv < 1e-15) return { error: 'Lỗi toán' };
      var d = VectorAPI.dot(u, v);
      var cosVal = Math.max(-1, Math.min(1, d / (nu * nv)));
      var rad = Math.acos(cosVal);
      var mode = 'deg';
      if (typeof optsOrAngle === 'string') mode = optsOrAngle;
      else if (optsOrAngle && optsOrAngle.angle) mode = optsOrAngle.angle;
      return cleanNum(fromRad(rad, mode));
    },

    unit: function (u) {
      if (!checkVec(u)) return { error: 'Lỗi kích thước' };
      var nu = VectorAPI.norm(u);
      if (nu < 1e-15) return { error: 'Lỗi toán' };
      var res = [];
      for (var i = 0; i < u.length; i++) res.push(cleanNum(Number(u[i]) / nu));
      return res;
    },

    evalExpr: function (text, vcts, opts) {
      if (typeof text !== 'string' || !text.replace(/\s+/g, '')) {
        return { error: 'Lỗi cú pháp' };
      }
      vcts = vcts || {};
      var angleMode = (opts && opts.angle) || 'deg';
      var toks = [];
      var i = 0;
      var s = text.replace(/^\s+|\s+$/g, '');
      while (i < s.length) {
        var ch = s.charAt(i);
        if (ch === ' ' || ch === '\t') { i++; continue; }
        if (ch === '+' || ch === '-' || ch === '−' || ch === '*' || ch === '×' || ch === '/' || ch === '÷' || ch === '·') {
          var op = ch === '−' ? '-' : (ch === '×' ? '*' : (ch === '÷' ? '/' : ch));
          toks.push({ type: 'OP', value: op });
          i++;
          continue;
        }
        if (ch === '(') { toks.push({ type: 'LP' }); i++; continue; }
        if (ch === ')') { toks.push({ type: 'RP' }); i++; continue; }
        if (ch === ',') { toks.push({ type: 'COMMA' }); i++; continue; }
        if ((ch >= '0' && ch <= '9') || ch === '.') {
          var nStr = '';
          while (i < s.length && ((s.charAt(i) >= '0' && s.charAt(i) <= '9') || s.charAt(i) === '.')) {
            nStr += s.charAt(i++);
          }
          toks.push({ type: 'NUM', value: parseFloat(nStr) });
          continue;
        }
        var rest = s.slice(i);
        var mVct = rest.match(/^(VctAns|VctA|VctB|VctC|VctD)/);
        if (mVct) {
          toks.push({ type: 'VCT', name: mVct[1] });
          i += mVct[1].length;
          continue;
        }
        var mFn = rest.match(/^(Angle|angle|UnitV|unitV|unit|Dot|dot|Cross|cross|Abs|abs|Norm|norm)/);
        if (mFn) {
          toks.push({ type: 'FN', name: mFn[1].toLowerCase() });
          i += mFn[1].length;
          continue;
        }
        return { error: 'Lỗi cú pháp' };
      }

      var pos = 0;
      function peek() { return pos < toks.length ? toks[pos] : null; }
      function consume() { return toks[pos++]; }
      function unwrap(v) {
        if (v && typeof v === 'object' && v.error) throw new Error(v.error);
        return v;
      }

      function parseAdd() {
        var left = parseMul();
        while (true) {
          var t = peek();
          if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
            consume();
            var right = parseMul();
            if (typeof left === 'number' && typeof right === 'number') {
              left = t.value === '+' ? (left + right) : (left - right);
            } else if (Array.isArray(left) && Array.isArray(right)) {
              left = unwrap(t.value === '+' ? VectorAPI.add(left, right) : VectorAPI.sub(left, right));
            } else throw new Error('Lỗi kích thước');
          } else break;
        }
        return left;
      }

      function parseMul() {
        var left = parseUnary();
        while (true) {
          var t = peek();
          if (t && t.type === 'OP' && (t.value === '*' || t.value === '/' || t.value === '·')) {
            consume();
            var right = parseUnary();
            if (t.value === '·') {
              left = unwrap(VectorAPI.dot(left, right));
            } else if (t.value === '*') {
              if (typeof left === 'number' && typeof right === 'number') left = left * right;
              else if (Array.isArray(left) && Array.isArray(right)) left = unwrap(VectorAPI.cross(left, right));
              else left = unwrap(VectorAPI.scale(left, right));
            } else {
              if (typeof right !== 'number' || Math.abs(right) < 1e-15) throw new Error('Lỗi toán');
              if (typeof left === 'number') left = left / right;
              else left = unwrap(VectorAPI.scale(1 / right, left));
            }
          } else if (t && (t.type === 'VCT' || t.type === 'FN' || t.type === 'LP')) {
            var rImp = parseUnary();
            if (typeof left === 'number' && Array.isArray(rImp)) left = unwrap(VectorAPI.scale(left, rImp));
            else if (Array.isArray(left) && Array.isArray(rImp)) left = unwrap(VectorAPI.cross(left, rImp));
            else throw new Error('Lỗi cú pháp');
          } else break;
        }
        return left;
      }

      function parseUnary() {
        var t = peek();
        if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
          consume();
          var v = parseUnary();
          if (t.value === '-') {
            return typeof v === 'number' ? -v : unwrap(VectorAPI.scale(-1, v));
          }
          return v;
        }
        return parseAtom();
      }

      function parseAtom() {
        var t = peek();
        if (!t) throw new Error('Lỗi cú pháp');
        if (t.type === 'NUM') { consume(); return t.value; }
        if (t.type === 'VCT') {
          consume();
          var v = vcts[t.name];
          if (!v) throw new Error('Lỗi kích thước');
          return v.slice();
        }
        if (t.type === 'LP') {
          consume();
          var val = parseAdd();
          if (peek() && peek().type === 'RP') consume();
          return val;
        }
        if (t.type === 'FN') {
          consume();
          if (peek() && peek().type === 'LP') consume();
          var a1 = parseAdd();
          var a2 = null;
          if (peek() && peek().type === 'COMMA') {
            consume();
            a2 = parseAdd();
          }
          if (peek() && peek().type === 'RP') consume();
          if (t.name === 'abs' || t.name === 'norm') {
            return typeof a1 === 'number' ? Math.abs(a1) : unwrap(VectorAPI.norm(a1));
          }
          if (t.name === 'unitv' || t.name === 'unit') return unwrap(VectorAPI.unit(a1));
          if (t.name === 'dot') return unwrap(VectorAPI.dot(a1, a2));
          if (t.name === 'cross') return unwrap(VectorAPI.cross(a1, a2));
          if (t.name === 'angle') return unwrap(VectorAPI.angle(a1, a2, angleMode));
        }
        throw new Error('Lỗi cú pháp');
      }

      try {
        var out = parseAdd();
        if (pos < toks.length) return { error: 'Lỗi cú pháp' };
        return { ok: true, result: out };
      } catch (e) {
        return { error: (e && e.message) || 'Lỗi toán' };
      }
    }
  };

  CalcEngine.vector = VectorAPI;

  // ---------------------------------------------------------------------------
  // 5. PHÂN PHỐI XÁC SUẤT (CalcEngine.dist)
  // ---------------------------------------------------------------------------
  // Hàm erfc(x) chính xác tới ~1e-15 (Chuỗi Taylor cho |x| <= 3, Liên phân số Laplace cho |x| > 3)
  function erfcHighPrec(x) {
    if (x < 0) return 2 - erfcHighPrec(-x);
    if (x === 0) return 1;
    if (x > 28) return 0;
    var SQRT_PI = 1.7724538509055160273;
    var x2 = x * x;
    if (x <= 3.0) {
      var term = x;
      var sum = x;
      for (var n = 1; n <= 65; n++) {
        term = -term * x2 / n;
        var add = term / (2 * n + 1);
        sum += add;
        if (Math.abs(add) < 1e-16 * Math.abs(sum)) break;
      }
      var erfVal = (2 / SQRT_PI) * sum;
      return 1 - erfVal;
    }
    // Liên phân số cho erfc(x) khi x > 3:
    // erfc(x) = (exp(-x^2) / sqrt(pi)) * 1 / (x + (1/2)/(x + (2/2)/(x + (3/2)/(x + ...))))
    var f = 0;
    for (var k = 60; k >= 1; k--) {
      f = (0.5 * k) / (x + f);
    }
    return (Math.exp(-x2) / SQRT_PI) / (x + f);
  }

  function stdNormCDF(z) {
    if (!isNum(z)) return NaN;
    return 0.5 * erfcHighPrec(-z / Math.SQRT2);
  }

  function stdNormPDF(z) {
    return Math.exp(-0.5 * z * z) / 2.5066282746310005024;
  }

  // Xấp xỉ Acklam + tinh chỉnh Newton-Halley cho phân vị chuẩn tắc
  function invStdNorm(p) {
    if (!isNum(p) || p <= 0 || p >= 1) return NaN;
    var a1 = -3.969683028665376e+01, a2 =  2.209460984245205e+02,
        a3 = -2.759285104469687e+02, a4 =  1.383577518672690e+02,
        a5 = -3.066479806614716e+01, a6 =  2.506628277459239e+00;
    var b1 = -5.447609879822406e+01, b2 =  1.615858368580409e+02,
        b3 = -1.556989798598866e+02, b4 =  6.680131188771972e+01,
        b5 = -1.328068155288572e+01;
    var c1 = -7.784894002430293e-03, c2 = -3.223964580411365e-01,
        c3 = -2.400758277161838e+00, c4 = -2.549732539343734e+00,
        c5 =  4.374664141464968e+00, c6 =  2.938163982698783e+00;
    var d1 =  7.784695709041462e-03, d2 =  3.224671290700398e-01,
        d3 =  2.445134137142996e+00, d4 =  3.754408661907416e+00;

    var pLow = 0.02425;
    var pHigh = 1 - pLow;
    var q, r, z;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      z = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
          ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      z = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
          (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      z = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
           ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }

    // 3 bước lặp Halley-Newton để đạt độ chính xác 1e-15
    for (var it = 0; it < 3; it++) {
      var err = stdNormCDF(z) - p;
      var pdf = stdNormPDF(z);
      if (pdf > 0) {
        var u = err / pdf;
        z = z - u / (1 + 0.5 * z * u);
      }
    }
    return z;
  }

  function lnFactorial(n) {
    if (n <= 1) return 0;
    var s = 0;
    for (var i = 2; i <= n; i++) s += Math.log(i);
    return s;
  }

  function singleBinomPD(k, n, p) {
    k = Number(k);
    if (!isNum(k) || Math.abs(k - Math.round(k)) > 1e-9) return 0;
    k = Math.round(k);
    if (k < 0 || k > n) return 0;
    if (p === 0) return k === 0 ? 1 : 0;
    if (p === 1) return k === n ? 1 : 0;
    if (n <= 60) {
      return combC(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    }
    var lp = lnFactorial(n) - lnFactorial(k) - lnFactorial(n - k) +
             k * Math.log(p) + (n - k) * Math.log(1 - p);
    return Math.exp(lp);
  }

  function singlePoissonPD(k, lambda) {
    k = Number(k);
    if (!isNum(k) || Math.abs(k - Math.round(k)) > 1e-9) return 0;
    k = Math.round(k);
    if (k < 0) return 0;
    if (lambda === 0) return k === 0 ? 1 : 0;
    return Math.exp(-lambda + k * Math.log(lambda) - lnFactorial(k));
  }

  var DistAPI = {
    normPD: function (x, sigma, mu) {
      if (sigma === undefined) sigma = 1;
      if (mu === undefined) mu = 0;
      sigma = Number(sigma); mu = Number(mu);
      if (!isNum(sigma) || sigma <= 0 || !isNum(mu)) return { error: 'Lỗi toán' };
      if (Array.isArray(x)) {
        var out = [];
        for (var i = 0; i < x.length; i++) {
          out.push(DistAPI.normPD(x[i], sigma, mu));
        }
        return out;
      }
      x = Number(x);
      if (!isNum(x)) return { error: 'Lỗi toán' };
      var z = (x - mu) / sigma;
      return stdNormPDF(z) / sigma;
    },

    normCD: function (lower, upper, sigma, mu) {
      if (sigma === undefined) sigma = 1;
      if (mu === undefined) mu = 0;
      lower = Number(lower); upper = Number(upper);
      sigma = Number(sigma); mu = Number(mu);
      if (!isNum(lower) || !isNum(upper) || !isNum(sigma) || sigma <= 0 || !isNum(mu)) {
        return { error: 'Lỗi toán' };
      }
      if (upper < lower) return 0;
      var z1 = (lower - mu) / sigma;
      var z2 = (upper - mu) / sigma;
      if (z1 >= 0) {
        return 0.5 * (erfcHighPrec(z1 / Math.SQRT2) - erfcHighPrec(z2 / Math.SQRT2));
      }
      if (z2 <= 0) {
        return 0.5 * (erfcHighPrec(-z2 / Math.SQRT2) - erfcHighPrec(-z1 / Math.SQRT2));
      }
      return stdNormCDF(z2) - stdNormCDF(z1);
    },

    invN: function (area, sigma, mu) {
      if (sigma === undefined) sigma = 1;
      if (mu === undefined) mu = 0;
      sigma = Number(sigma); mu = Number(mu);
      if (!isNum(sigma) || sigma <= 0 || !isNum(mu)) return { error: 'Lỗi toán' };
      if (Array.isArray(area)) {
        var out = [];
        for (var i = 0; i < area.length; i++) out.push(DistAPI.invN(area[i], sigma, mu));
        return out;
      }
      area = Number(area);
      if (!isNum(area) || area <= 0 || area >= 1) return { error: 'Lỗi toán' };
      return mu + sigma * invStdNorm(area);
    },

    binomPD: function (x, n, p) {
      n = Number(n); p = Number(p);
      if (!isNum(n) || n < 0 || Math.abs(n - Math.round(n)) > 1e-9 || !isNum(p) || p < 0 || p > 1) {
        return { error: 'Lỗi toán' };
      }
      n = Math.round(n);
      if (Array.isArray(x)) {
        var out = [];
        for (var i = 0; i < x.length; i++) out.push(singleBinomPD(x[i], n, p));
        return out;
      }
      return singleBinomPD(x, n, p);
    },

    binomCD: function (x, n, p) {
      n = Number(n); p = Number(p);
      if (!isNum(n) || n < 0 || Math.abs(n - Math.round(n)) > 1e-9 || !isNum(p) || p < 0 || p > 1) {
        return { error: 'Lỗi toán' };
      }
      n = Math.round(n);
      if (Array.isArray(x)) {
        var out = [];
        for (var i = 0; i < x.length; i++) out.push(DistAPI.binomCD(x[i], n, p));
        return out;
      }
      var kMax = Math.floor(Number(x) + 1e-9);
      if (kMax < 0) return 0;
      if (kMax >= n) return 1;
      var sum = 0;
      for (var k = 0; k <= kMax; k++) {
        sum += singleBinomPD(k, n, p);
      }
      return Math.min(1, sum);
    },

    poissonPD: function (x, lambda) {
      lambda = Number(lambda);
      if (!isNum(lambda) || lambda <= 0) return { error: 'Lỗi toán' };
      if (Array.isArray(x)) {
        var out = [];
        for (var i = 0; i < x.length; i++) out.push(singlePoissonPD(x[i], lambda));
        return out;
      }
      return singlePoissonPD(x, lambda);
    },

    poissonCD: function (x, lambda) {
      lambda = Number(lambda);
      if (!isNum(lambda) || lambda <= 0) return { error: 'Lỗi toán' };
      if (Array.isArray(x)) {
        var out = [];
        for (var i = 0; i < x.length; i++) out.push(DistAPI.poissonCD(x[i], lambda));
        return out;
      }
      var kMax = Math.floor(Number(x) + 1e-9);
      if (kMax < 0) return 0;
      var sum = 0;
      for (var k = 0; k <= kMax; k++) {
        sum += singlePoissonPD(k, lambda);
      }
      return Math.min(1, sum);
    }
  };

  CalcEngine.dist = DistAPI;

  // ---------------------------------------------------------------------------
  // 6. BẢNG TÍNH (CalcEngine.sheet) — 45 hàng × 5 cột (A–E)
  // ---------------------------------------------------------------------------
  function parseCellRef(ref) {
    if (typeof ref !== 'string') return null;
    var m = ref.replace(/\s+/g, '').match(/^\$?([A-Ea-e])\$?([1-9]|[1-3][0-9]|4[0-5])$/);
    if (!m) return null;
    var col = m[1].toUpperCase().charCodeAt(0) - 65;
    var row = parseInt(m[2], 10) - 1;
    return { col: col, row: row, key: m[1].toUpperCase() + (row + 1) };
  }

  function makeCellKey(col, row) {
    return String.fromCharCode(65 + col) + String(row + 1);
  }

  function expandRangeKeys(rangeStr) {
    var parts = String(rangeStr || '').split(':');
    if (parts.length === 1) {
      var single = parseCellRef(parts[0]);
      return single ? [single.key] : null;
    }
    if (parts.length !== 2) return null;
    var p1 = parseCellRef(parts[0]);
    var p2 = parseCellRef(parts[1]);
    if (!p1 || !p2) return null;
    var cMin = Math.min(p1.col, p2.col), cMax = Math.max(p1.col, p2.col);
    var rMin = Math.min(p1.row, p2.row), rMax = Math.max(p1.row, p2.row);
    var keys = [];
    for (var r = rMin; r <= rMax; r++) {
      for (var c = cMin; c <= cMax; c++) {
        keys.push(makeCellKey(c, r));
      }
    }
    return keys;
  }

  function shiftFormulaRefs(formula, dCol, dRow) {
    var fStr = String(formula || '');
    if (fStr.charAt(0) !== '=') fStr = '=' + fStr;
    return fStr.replace(/(\$?)([A-Ea-e])(\$?)([1-9]|[1-3][0-9]|4[0-5])\b/g, function (full, absC, colCh, absR, rowStr) {
      var c = colCh.toUpperCase().charCodeAt(0) - 65;
      var r = parseInt(rowStr, 10) - 1;
      var nc = absC ? c : (c + dCol);
      var nr = absR ? r : (r + dRow);
      if (nc < 0 || nc > 4 || nr < 0 || nr >= 45) return '#REF!';
      return (absC || '') + String.fromCharCode(65 + nc) + (absR || '') + String(nr + 1);
    });
  }

  var SheetAPI = {
    newSheet: function () {
      var cells = {};
      for (var r = 0; r < 45; r++) {
        for (var c = 0; c < 5; c++) {
          var k = makeCellKey(c, r);
          cells[k] = { raw: '', value: null };
        }
      }
      var sh = {
        rows: 45,
        cols: 5,
        autoRecalc: true,
        cells: cells
      };
      sh.setCell = function (ref, content) { return SheetAPI.setCell(sh, ref, content); };
      sh.getValue = function (ref) { return SheetAPI.getValue(sh, ref); };
      sh.recalc = function () { return SheetAPI.recalc(sh); };
      sh.fillFormula = function (f, rng) { return SheetAPI.fillFormula(sh, f, rng); };
      sh.fillValue = function (v, rng) { return SheetAPI.fillValue(sh, v, rng); };
      return sh;
    },

    setCell: function (sh, ref, content) {
      var p = parseCellRef(ref);
      if (!sh || !sh.cells || !p) return 'Lỗi';
      var rawStr = (content === undefined || content === null) ? '' : String(content);
      rawStr = rawStr.replace(/^\s+|\s+$/g, '');
      // Hỗ trợ trường hợp nhập '==A1+A2' thành '=A1+A2'
      if (rawStr.slice(0, 2) === '==') rawStr = '=' + rawStr.slice(2);
      sh.cells[p.key].raw = rawStr;
      if (sh.autoRecalc !== false) {
        SheetAPI.recalc(sh);
      }
      return sh.cells[p.key].value;
    },

    getValue: function (sh, ref) {
      var p = parseCellRef(ref);
      if (!sh || !sh.cells || !p) return 'Lỗi';
      return sh.cells[p.key].value;
    },

    getRaw: function (sh, ref) {
      var p = parseCellRef(ref);
      if (!sh || !sh.cells || !p) return '';
      return sh.cells[p.key].raw;
    },

    recalc: function (sh) {
      if (!sh || !sh.cells) return sh;
      var state = {}; // 0: chưa tính, 1: đang tính (phát hiện vòng), 2: đã tính

      function evalCellByKey(key) {
        var cell = sh.cells[key];
        if (!cell) return 0;
        if (state[key] === 2) return cell.value;
        if (state[key] === 1) {
          cell.value = 'Lỗi';
          state[key] = 2;
          return 'Lỗi';
        }
        state[key] = 1;
        var raw = cell.raw;
        if (raw === '') {
          cell.value = null;
          state[key] = 2;
          return null;
        }
        if (raw.charAt(0) !== '=') {
          var num = Number(raw);
          if (isNum(num)) {
            cell.value = cleanNum(num);
          } else {
            var rEv = CalcEngine.evalText(raw);
            cell.value = rEv.ok ? cleanNum(rEv.value) : 'Lỗi';
          }
          state[key] = 2;
          return cell.value;
        }

        var expr = raw.slice(1).replace(/^\s+|\s+$/g, '');
        if (!expr || expr.indexOf('#REF!') !== -1) {
          cell.value = 'Lỗi';
          state[key] = 2;
          return 'Lỗi';
        }

        var hasErr = false;

        // Xử lý các hàm vùng: Sum, Mean, Min, Max
        expr = expr.replace(/(Sum|Mean|Avg|Min|Max)\s*\(([^()]*)\)/gi, function (full, fnName, argStr) {
          var fn = fnName.toLowerCase();
          var subArgs = argStr.split(',');
          var vals = [];
          for (var i = 0; i < subArgs.length; i++) {
            var part = subArgs[i].replace(/^\s+|\s+$/g, '');
            if (!part) continue;
            var rKeys = expandRangeKeys(part);
            if (rKeys) {
              for (var k = 0; k < rKeys.length; k++) {
                var cv = evalCellByKey(rKeys[k]);
                if (cv === 'Lỗi') { hasErr = true; return 'NaN'; }
                if (cv !== null && isNum(cv)) vals.push(cv);
              }
            } else {
              var subEv = CalcEngine.evalText(part);
              if (!subEv.ok) { hasErr = true; return 'NaN'; }
              vals.push(subEv.value);
            }
          }
          if (hasErr) return 'NaN';
          if (fn === 'sum') {
            var s = 0;
            for (var j = 0; j < vals.length; j++) s += vals[j];
            return '(' + String(s) + ')';
          }
          if (vals.length === 0) {
            hasErr = true;
            return 'NaN';
          }
          if (fn === 'mean' || fn === 'avg') {
            var sm = 0;
            for (var m = 0; m < vals.length; m++) sm += vals[m];
            return '(' + String(sm / vals.length) + ')';
          }
          if (fn === 'min') {
            var mn = vals[0];
            for (var n = 1; n < vals.length; n++) if (vals[n] < mn) mn = vals[n];
            return '(' + String(mn) + ')';
          }
          if (fn === 'max') {
            var mx = vals[0];
            for (var p = 1; p < vals.length; p++) if (vals[p] > mx) mx = vals[p];
            return '(' + String(mx) + ')';
          }
          return 'NaN';
        });

        if (hasErr) {
          cell.value = 'Lỗi';
          state[key] = 2;
          return 'Lỗi';
        }

        // Thay thế tham chiếu ô đơn A1..E45
        expr = expr.replace(/\$?([A-Ea-e])\$?([1-9]|[1-3][0-9]|4[0-5])\b/g, function (full, colCh, rowStr) {
          var refKey = colCh.toUpperCase() + String(parseInt(rowStr, 10));
          var refVal = evalCellByKey(refKey);
          if (refVal === 'Lỗi') {
            hasErr = true;
            return 'NaN';
          }
          if (refVal === null || refVal === undefined) return '(0)';
          return '(' + String(refVal) + ')';
        });

        if (hasErr) {
          cell.value = 'Lỗi';
          state[key] = 2;
          return 'Lỗi';
        }

        var res = CalcEngine.evalText(expr);
        if (!res.ok) {
          cell.value = 'Lỗi';
        } else {
          cell.value = cleanNum(res.value);
        }
        state[key] = 2;
        return cell.value;
      }

      for (var r = 0; r < 45; r++) {
        for (var c = 0; c < 5; c++) {
          var k = makeCellKey(c, r);
          if (!state[k]) evalCellByKey(k);
        }
      }
      return sh;
    },

    fillFormula: function (sh, formulaOrRange, rangeOrFormula) {
      if (!sh || !sh.cells) return sh;
      var formula = String(formulaOrRange || '');
      var rangeStr = String(rangeOrFormula || '');
      // Tự động nhận biết nếu người gọi truyền (sh, range, formula)
      if (formula.indexOf(':') !== -1 && rangeStr.indexOf(':') === -1 && parseCellRef(formula.split(':')[0])) {
        var tmp = formula; formula = rangeStr; rangeStr = tmp;
      }
      if (formula.charAt(0) !== '=') formula = '=' + formula;
      var parts = rangeStr.split(':');
      var p1 = parseCellRef(parts[0]);
      var p2 = parts.length > 1 ? parseCellRef(parts[1]) : p1;
      if (!p1 || !p2) return sh;
      var cMin = Math.min(p1.col, p2.col), cMax = Math.max(p1.col, p2.col);
      var rMin = Math.min(p1.row, p2.row), rMax = Math.max(p1.row, p2.row);
      for (var r = rMin; r <= rMax; r++) {
        for (var c = cMin; c <= cMax; c++) {
          var k = makeCellKey(c, r);
          sh.cells[k].raw = shiftFormulaRefs(formula, c - cMin, r - rMin);
        }
      }
      if (sh.autoRecalc !== false) SheetAPI.recalc(sh);
      return sh;
    },

    fillValue: function (sh, valOrExpr, rangeStr) {
      if (!sh || !sh.cells) return sh;
      var vStr = String(valOrExpr === undefined ? '' : valOrExpr);
      var rStr = String(rangeStr || '');
      if (vStr.indexOf(':') !== -1 && rStr.indexOf(':') === -1 && parseCellRef(vStr.split(':')[0])) {
        var tmp = vStr; vStr = rStr; rStr = tmp;
      }
      var parts = rStr.split(':');
      var p1 = parseCellRef(parts[0]);
      var p2 = parts.length > 1 ? parseCellRef(parts[1]) : p1;
      if (!p1 || !p2) return sh;
      var cMin = Math.min(p1.col, p2.col), cMax = Math.max(p1.col, p2.col);
      var rMin = Math.min(p1.row, p2.row), rMax = Math.max(p1.row, p2.row);

      // Tính giá trị cho từng ô (nếu vStr là công thức tương đối thì dịch theo ô rồi lấy giá trị tĩnh)
      var computedMap = {};
      for (var r = rMin; r <= rMax; r++) {
        for (var c = cMin; c <= cMax; c++) {
          var k = makeCellKey(c, r);
          var shifted = shiftFormulaRefs(vStr, c - cMin, r - rMin);
          var oldRaw = sh.cells[k].raw;
          sh.cells[k].raw = shifted;
          SheetAPI.recalc(sh);
          var cv = sh.cells[k].value;
          sh.cells[k].raw = oldRaw;
          computedMap[k] = (cv === 'Lỗi' || cv === null) ? '0' : String(cv);
        }
      }
      for (var r2 = rMin; r2 <= rMax; r2++) {
        for (var c2 = cMin; c2 <= cMax; c2++) {
          var k2 = makeCellKey(c2, r2);
          sh.cells[k2].raw = computedMap[k2];
        }
      }
      if (sh.autoRecalc !== false) SheetAPI.recalc(sh);
      return sh;
    }
  };

  CalcEngine.sheet = SheetAPI;

  // ---------------------------------------------------------------------------
  // 7. HỘP TOÁN HỌC (CalcEngine.mathbox) — Tung xúc xắc & Tung đồng xu
  // ---------------------------------------------------------------------------
  function mul32(a, b) {
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
    var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return (al * bl + (((ah * bl + al * bh) & 0xffff) << 16)) | 0;
  }

  function createSeededRng(seed) {
    if (seed === undefined || seed === null || seed === '') {
      return function () { return Math.random(); };
    }
    var a = (Number(seed) | 0) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = mul32(a ^ (a >>> 15), 1 | a);
      t = (t + mul32(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var MathBoxAPI = {
    rollDice: function (times, diceCount, seed) {
      times = Number(times === undefined ? 10 : times);
      diceCount = Number(diceCount === undefined ? 1 : diceCount);
      if (!isNum(times) || times < 1 || times > 10000 || !isNum(diceCount) || diceCount < 1 || diceCount > 3) {
        return { error: 'Lỗi toán' };
      }
      times = Math.round(times);
      diceCount = Math.round(diceCount);
      var rng = createSeededRng(seed);
      var minSum = diceCount;
      var maxSum = 6 * diceCount;
      var freqObj = {};
      for (var s = minSum; s <= maxSum; s++) freqObj[s] = 0;

      var results = [];
      var rolls = [];
      for (var i = 0; i < times; i++) {
        var sum = 0;
        var oneRoll = [];
        for (var d = 0; d < diceCount; d++) {
          var face = 1 + Math.floor(rng() * 6);
          if (face > 6) face = 6;
          oneRoll.push(face);
          sum += face;
        }
        results.push(sum);
        rolls.push(oneRoll);
        freqObj[sum] = (freqObj[sum] || 0) + 1;
      }

      var sums = [];
      var freqArr = [];
      var relFreqArr = [];
      var table = [];
      for (var k = minSum; k <= maxSum; k++) {
        var c = freqObj[k] || 0;
        var rf = c / times;
        sums.push(k);
        freqArr.push(c);
        relFreqArr.push(rf);
        table.push({ sum: k, freq: c, count: c, relFreq: rf });
      }

      return {
        ok: true,
        times: times,
        diceCount: diceCount,
        results: results,
        rolls: rolls,
        sums: sums,
        frequencies: freqObj,
        freq: freqArr,
        relFreq: relFreqArr,
        table: table
      };
    },

    tossCoin: function (times, coinCount, seed) {
      times = Number(times === undefined ? 10 : times);
      coinCount = Number(coinCount === undefined ? 1 : coinCount);
      if (!isNum(times) || times < 1 || times > 10000 || !isNum(coinCount) || coinCount < 1 || coinCount > 3) {
        return { error: 'Lỗi toán' };
      }
      times = Math.round(times);
      coinCount = Math.round(coinCount);
      var rng = createSeededRng(seed);
      var freqObj = {};
      for (var h = 0; h <= coinCount; h++) freqObj[h] = 0;

      var results = [];
      var tosses = [];
      for (var i = 0; i < times; i++) {
        var heads = 0;
        var oneToss = [];
        for (var c = 0; c < coinCount; c++) {
          var isHead = Math.floor(rng() * 2) === 1 ? 1 : 0;
          oneToss.push(isHead);
          heads += isHead;
        }
        results.push(heads);
        tosses.push(oneToss);
        freqObj[heads] = (freqObj[heads] || 0) + 1;
      }

      var outcomes = [];
      var freqArr = [];
      var relFreqArr = [];
      var table = [];
      for (var k = 0; k <= coinCount; k++) {
        var cnt = freqObj[k] || 0;
        var rf = cnt / times;
        outcomes.push(k);
        freqArr.push(cnt);
        relFreqArr.push(rf);
        table.push({ sum: k, heads: k, freq: cnt, count: cnt, relFreq: rf });
      }

      return {
        ok: true,
        times: times,
        coinCount: coinCount,
        results: results,
        tosses: tosses,
        outcomes: outcomes,
        frequencies: freqObj,
        freq: freqArr,
        relFreq: relFreqArr,
        table: table
      };
    }
  };

  CalcEngine.mathbox = MathBoxAPI;

  // ---------------------------------------------------------------------------
  // 8. THUẬT TOÁN (CalcEngine.algo)
  // ---------------------------------------------------------------------------
  function evalAlgoExpr(expr, vars, angleMode) {
    if (typeof expr === 'number') return expr;
    var s = String(expr === undefined ? '0' : expr).replace(/^\s+|\s+$/g, '');
    if (s === '') return 0;
    var r = CalcEngine.evalText(s, { angle: angleMode || 'deg', vars: vars, skipExact: true });
    if (!r.ok) throw new Error(r.error || 'Lỗi toán');
    return r.value;
  }

  function evalAlgoAtomCond(condStr, vars, angleMode) {
    var s = String(condStr || '').replace(/^\s+|\s+$/g, '');
    if (!s) return false;
    var ops = ['<=', '>=', '!=', '<>', '==', '≤', '≥', '≠', '<', '>', '='];
    var foundOp = null;
    var splitIdx = -1;
    var depth = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (depth === 0) {
        for (var k = 0; k < ops.length; k++) {
          var op = ops[k];
          if (s.slice(i, i + op.length) === op) {
            foundOp = op;
            splitIdx = i;
            break;
          }
        }
        if (foundOp) break;
      }
    }
    if (!foundOp) {
      return Math.abs(evalAlgoExpr(s, vars, angleMode)) > 1e-12;
    }
    var lhs = evalAlgoExpr(s.slice(0, splitIdx), vars, angleMode);
    var rhs = evalAlgoExpr(s.slice(splitIdx + foundOp.length), vars, angleMode);
    if (foundOp === '<') return lhs < rhs - 1e-12;
    if (foundOp === '>') return lhs > rhs + 1e-12;
    if (foundOp === '<=' || foundOp === '≤') return lhs <= rhs + 1e-12;
    if (foundOp === '>=' || foundOp === '≥') return lhs >= rhs - 1e-12;
    if (foundOp === '=' || foundOp === '==') return Math.abs(lhs - rhs) <= 1e-11;
    if (foundOp === '≠' || foundOp === '!=' || foundOp === '<>') return Math.abs(lhs - rhs) > 1e-11;
    return false;
  }

  function evalAlgoCond(condStr, vars, angleMode) {
    var s = String(condStr || '');
    var orParts = s.split(/\s+or\s+/i);
    for (var i = 0; i < orParts.length; i++) {
      var andParts = orParts[i].split(/\s+and\s+/i);
      var allTrue = true;
      for (var j = 0; j < andParts.length; j++) {
        if (!evalAlgoAtomCond(andParts[j], vars, angleMode)) {
          allTrue = false;
          break;
        }
      }
      if (allTrue) return true;
    }
    return false;
  }

  var AlgoAPI = {
    run: function (program, opts) {
      opts = opts || {};
      var vars = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, x: 0, y: 0, M: 0 };
      if (opts.vars) {
        for (var k in opts.vars) {
          if (Object.prototype.hasOwnProperty.call(opts.vars, k) && isNum(Number(opts.vars[k]))) {
            vars[k] = Number(opts.vars[k]);
          }
        }
      }
      var inputs = Array.isArray(opts.inputs) ? opts.inputs : [];
      var inputIdx = 0;
      var angleMode = opts.angle || 'deg';
      var maxSteps = opts.maxSteps || 10000;
      var steps = 0;
      var output = [];
      var turtle = {
        x: 0,
        y: 0,
        angle: 0,
        penDown: true,
        lines: []
      };

      function stepTick() {
        steps++;
        if (steps > maxSteps) {
          throw new Error('Quá nhiều bước');
        }
      }

      function execBlock(stmts) {
        if (!Array.isArray(stmts)) return;
        for (var i = 0; i < stmts.length; i++) {
          var st = stmts[i];
          if (!st || !st.op) continue;
          stepTick();
          var op = st.op;

          if (op === 'input') {
            var vIn = st.v || 'A';
            var valIn = inputIdx < inputs.length ? Number(inputs[inputIdx++]) : (vars[vIn] || 0);
            if (!isNum(valIn)) throw new Error('Lỗi toán');
            vars[vIn] = valIn;
          } else if (op === 'set') {
            var vSet = st.v || 'A';
            vars[vSet] = cleanNum(evalAlgoExpr(st.expr, vars, angleMode));
          } else if (op === 'print') {
            if (st.text !== undefined && st.text !== null && st.expr === undefined) {
              output.push(String(st.text));
            } else {
              var rawE = String(st.expr !== undefined ? st.expr : (st.text || '')).replace(/^\s+|\s+$/g, '');
              if (rawE.length >= 2 && ((rawE.charAt(0) === '"' && rawE.charAt(rawE.length - 1) === '"') ||
                                       (rawE.charAt(0) === "'" && rawE.charAt(rawE.length - 1) === "'"))) {
                output.push(rawE.slice(1, -1));
              } else {
                var pv = cleanNum(evalAlgoExpr(rawE, vars, angleMode));
                output.push(CalcEngine.format(pv, opts.format));
              }
            }
          } else if (op === 'repeat') {
            var nRep = Math.round(evalAlgoExpr(st.n !== undefined ? st.n : st.count, vars, angleMode));
            if (nRep < 0) throw new Error('Lỗi toán');
            for (var r = 0; r < nRep; r++) {
              stepTick();
              execBlock(st.body);
            }
          } else if (op === 'while') {
            while (evalAlgoCond(st.cond, vars, angleMode)) {
              stepTick();
              execBlock(st.body);
            }
          } else if (op === 'if') {
            if (evalAlgoCond(st.cond, vars, angleMode)) {
              execBlock(st.then || st.body);
            } else if (st.else) {
              execBlock(st.else);
            }
          } else if (op === 'move') {
            var dist = evalAlgoExpr(st.expr !== undefined ? st.expr : st.d, vars, angleMode);
            var rad = (turtle.angle * Math.PI) / 180;
            var nx = turtle.x + dist * Math.cos(rad);
            var ny = turtle.y + dist * Math.sin(rad);
            if (turtle.penDown) {
              turtle.lines.push({ x1: turtle.x, y1: turtle.y, x2: nx, y2: ny });
            }
            turtle.x = nx;
            turtle.y = ny;
          } else if (op === 'turn') {
            var deg = evalAlgoExpr(st.expr !== undefined ? st.expr : st.angle, vars, angleMode);
            turtle.angle += deg;
          } else if (op === 'goto') {
            var gx = evalAlgoExpr(st.x !== undefined ? st.x : 0, vars, angleMode);
            var gy = evalAlgoExpr(st.y !== undefined ? st.y : 0, vars, angleMode);
            if (turtle.penDown) {
              turtle.lines.push({ x1: turtle.x, y1: turtle.y, x2: gx, y2: gy });
            }
            turtle.x = gx;
            turtle.y = gy;
          } else if (op === 'pen') {
            turtle.penDown = !st.up;
          }
        }
      }

      try {
        execBlock(program);
        return {
          ok: true,
          output: output,
          vars: vars,
          turtle: turtle,
          steps: steps
        };
      } catch (e) {
        var msg = (e && e.message) ? e.message : 'Lỗi toán';
        return {
          ok: false,
          error: msg,
          output: output,
          vars: vars,
          turtle: turtle
        };
      }
    }
  };

  CalcEngine.algo = AlgoAPI;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalcEngine;
  } else {
    root.CalcEngine = CalcEngine;
  }
})(this);
