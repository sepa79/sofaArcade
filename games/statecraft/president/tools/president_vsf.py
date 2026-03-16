#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path


MODULE_NAME_LEN = 16
MODULE_HEADER_LEN = 22
KNOWN_SHARED = {
    0x452E: "DOCOL?",
    0x454D: "DOCON?",
    0x455E: "DOVAR?",
    0x4570: "DOUSER?",
    0x458B: "DODOES?",
}
KNOWN_WORDS = {
    0x4775: "?DUP",
    0x47CF: "UD/MOD?",
    0x47E5: "HOLD",
    0x47F7: "SIGN",
    0x481B: "#>",
    0x482D: "#",
    0x4853: "#S",
    0x4863: "<#",
    0x4895: "/MOD?",
    0x4881: "?NEGATE",
    0x488D: "ABS",
    0x4935: "D.R?",
    0x4998: "*",
    0x45F7: "2@",
    0x4605: "2!",
    0x4625: "1-",
    0x48C3: "/",
    0x48CB: "MAX",
    0x48DB: "TYPE",
    0x5064: "CR",
    0x513A: "SPACES",
    0x5AA6: "MAP-LOOP?",
    0x5B20: "MAP-COMMAND?",
    0x5A48: "2CR",
    0x57E4: "CLAMP?",
    0x58EA: "M+",
    0x5F79: "AT-XY?",
    0x611A: "D-",
    0x88B3: "POLLS-SCREEN",
    0x93B1: "TANK-MOVE?",
    0x93F5: "TANK-BATTLE-PROMPT",
    0x9471: "TILE-OWNER?",
    0x9489: "POINTER-PROMPT",
    0x9500: "MAP-MENU?",
    0x95AE: "SURVEY-MAP?",
    0x95CE: "SURVEY-SCAN?",
    0x9636: "SURVEY-SHOW?",
    0x970A: "MOVE-P?",
    0x9728: "DESTROY?",
    0x9FE6: "IMPORT-TANK?",
    0xA01A: "TANK-COST?",
    0xA030: "CAN-IMPORT-TANK?",
    0xA040: "IMPORT-TANK-PROMPT",
    0xA070: "IMPORT-TANK-FALLBACK?",
    0xA2D6: "CONTRACTS-SCREEN",
    0xA47E: "CONTRACT-RESULT",
    0xA5DE: "CONTRACT-SALES-SUMMARY",
    0xA670: "SPOT-MARKET?",
    0xA842: "GOLD-PRICE-SCREEN",
    0xA87A: "GOLD-STOCKS-SCREEN",
    0xA8AA: "AVG-GOLD-COST-SCREEN",
    0xAA20: "BUY-GOLD-PROMPT",
    0xAA88: "SELL-GOLD-PROMPT",
    0xAC62: "HEALTH-SCREEN",
    0xACB6: "HEALTH-ROWS",
    0xAF04: "POLLS-CHECK?",
    0xB0F4: "BOP-SCREEN",
    0xB20C: "INCOME-EXPENDITURE",
    0xB374: "ELECTION-RESULTS?",
    0xB39C: "NEW-PRESIDENCY-BANNER",
    0xB3BC: "ELECTION-TABLE",
    0xB7EE: "MONTH-ADVANCE?",
    0xB7F4: "ADVANCE-MONTH?",
    0xB816: "ADVANCE-YEAR?",
    0xB860: "EARTHQUAKE-TRIGGER?",
    0xB87C: "TURN-SUMMARY?",
    0xB888: "SCORE-COMPUTE?",
    0xB988: "GAME-SCORE-HEADER",
    0xB9C0: "GAME-SCORE-FRAME",
    0xB9EC: "GAME-SCORE-SCREEN",
    0xBA58: "POST-MONTH-ELECTION?",
    0xBAAA: "FOOD-ROW",
    0xBAD2: "FOOD-SCREEN",
    0xBD32: "IMPORTS-SCREEN",
    0xBE20: "CURRENCY-CRISIS?",
    0xBE46: "BANKRUPTCY-SCREEN",
    0xBE6C: "DEVALUATION-SCREEN",
    0xBEE4: "GAME-OVER-LOOP",
    0xBF04: "RESET-NEW-GAME?",
    0xBF0C: "EARTHQUAKE-EVENT",
    0xBF30: "EARTHQUAKE-DAMAGE?",
    0xBF5A: "RESET-STATE?",
    0xBF6A: "RESET-ECONOMY?",
    0xBFC6: "RESET-PRICES?",
    0xC01E: "RESET-POLITICS?",
    0xC06E: "RESET-TRADE?",
    0xC0BC: "RESET-SCORE?",
    0xC132: "RESET-WORLD?",
    0xC238: "ELECTION-COUNTDOWN",
    0xC29A: "NEW-GAME-INIT?",
    0xC2CA: "MAIN-LOOP?",
    0xC2E0: "TURN-LOOP?",
}
KNOWN_PRIMITIVES = {
    0x4079: "LIT",
    0x40C7: "EXECUTE",
    0x40DD: "(OF)",
    0x4111: "BRANCH",
    0x4130: "0BRANCH",
    0x4151: "LOOP?",
    0x4177: "+LOOP?",
    0x41A7: "2>R?",
    0x41BC: "R@",
    0x41CD: "R>",
    0x41EF: "DIGIT?",
    0x4217: "MATCH?",
    0x42E3: "UM*",
    0x4316: "U/MOD?",
    0x439F: "EXIT?",
    0x43AA: "R@?",
    0x43C0: ">R?",
    0x43CD: "R>?",
    0x43DA: "0=?",
    0x437D: "SP@",
    0x4386: "SP0!",
    0x4390: "RP0!",
    0x43F7: "=",
    0x4400: "+",
    0x4414: "D+",
    0x4432: "NEGATE?",
    0x4442: "DNEGATE",
    0x445C: "DROP",
    0x4452: "OVER",
    0x445E: "SWAP",
    0x4473: "DUP",
    0x447D: "NIP",
    0x44AC: "0<?",
    0x44B8: "+!?",
    0x44D0: "XOR!?",
    0x44DB: "@+?",
    0x44EB: "C@",
    0x44F6: "!",
    0x4509: "C!",
    0x4615: "<",
    0x461D: "-",
    0x4635: "2DUP",
    0x4BB0: ">",
    0x4C2C: "MIN",
    0x4485: "ROT",
    0x434D: "AND",
    0x435D: "OR",
    0x436D: "XOR",
    0x42C3: "CMOVE",
    0x45A9: "0",
    0x45B1: "1",
    0x45BB: "2",
    0x45C5: "3",
    0x45CF: "4",
    0x45D9: "320",
    0x45E3: "BL",
    0x45ED: "40",
    0x5355: "1+",
    0x5361: "2+",
}


@dataclass(frozen=True)
class TokenInfo:
    token: int
    code_ptr: int
    kind: str
    display: str
    detail: int | None = None


@dataclass(frozen=True)
class Module:
    name: str
    major: int
    minor: int
    size: int
    offset: int

    @property
    def payload_offset(self) -> int:
        return self.offset + MODULE_HEADER_LEN

    @property
    def payload_size(self) -> int:
        return self.size - MODULE_HEADER_LEN


@dataclass(frozen=True)
class Word:
    addr: int
    flags: int
    length: int
    name: str
    link: int
    code_ptr: int

    @property
    def cfa_addr(self) -> int:
        return self.addr + 1 + self.length + 2

    @property
    def inline_code(self) -> bool:
        return self.code_ptr == self.cfa_addr + 2


def find_module_table(data: bytes) -> int:
    off = data.find(b"MAINCPU\x00")
    if off == -1:
        raise ValueError("Could not locate MAINCPU module header")
    return off


def parse_modules(data: bytes) -> list[Module]:
    modules: list[Module] = []
    off = find_module_table(data)
    while off + MODULE_HEADER_LEN <= len(data):
        raw_name = data[off : off + MODULE_NAME_LEN]
        name = raw_name.split(b"\x00", 1)[0].decode("ascii", "replace")
        major = data[off + 16]
        minor = data[off + 17]
        size = int.from_bytes(data[off + 18 : off + 22], "little")
        if not name or size < MODULE_HEADER_LEN:
            break
        modules.append(Module(name=name, major=major, minor=minor, size=size, offset=off))
        off += size
    return modules


def extract_c64mem_ram(data: bytes, modules: list[Module]) -> bytes:
    mod = next((m for m in modules if m.name == "C64MEM"), None)
    if mod is None:
        raise ValueError("C64MEM module not found")

    payload = data[mod.payload_offset : mod.offset + mod.size]
    for start in range(0, min(64, len(payload) - 65536 + 1)):
        if start + 0x080d >= len(payload):
            break
        basic = payload[start + 0x0801 : start + 0x080d]
        next_line = int.from_bytes(basic[0:2], "little")
        line_number = int.from_bytes(basic[2:4], "little")
        if 0x0801 < next_line < 0x0900 and 0 < line_number < 64000 and basic[4] == 0x9E:
            return payload[start : start + 65536]

    raise ValueError("Could not identify 64 KB RAM window inside C64MEM payload")


def is_printable_name_byte(value: int) -> bool:
    value &= 0x7F
    return 32 <= value <= 95 or 97 <= value <= 122


def decode_name(name_bytes: bytes) -> str:
    return "".join(chr(byte & 0x7F) for byte in name_bytes)


def iter_candidate_words(ram: bytes, start: int, end: int) -> list[Word]:
    words: list[Word] = []
    limit = min(end, len(ram) - 6)
    for addr in range(max(0, start), limit):
        count = ram[addr]
        if not (count & 0x80):
            continue
        length = count & 0x1F
        if length == 0 or addr + 1 + length + 4 > len(ram):
            continue

        name_bytes = ram[addr + 1 : addr + 1 + length]
        if any(byte & 0x80 for byte in name_bytes[:-1]):
            continue
        if not (name_bytes[-1] & 0x80):
            continue
        if not all(is_printable_name_byte(byte) for byte in name_bytes):
            continue

        link_off = addr + 1 + length
        link = int.from_bytes(ram[link_off : link_off + 2], "little")
        code_ptr = int.from_bytes(ram[link_off + 2 : link_off + 4], "little")
        if link not in (0,) and not (0x0200 <= link < addr):
            continue
        if not (0x0200 <= code_ptr < 0x10000):
            continue

        words.append(
            Word(
                addr=addr,
                flags=count,
                length=length,
                name=decode_name(name_bytes),
                link=link,
                code_ptr=code_ptr,
            )
        )
    return words


def cmd_modules(args: argparse.Namespace) -> int:
    data = Path(args.snapshot).read_bytes()
    for module in parse_modules(data):
        print(f"{module.offset:06x}  {module.name:<12} v{module.major}.{module.minor}  size={module.size}")
    return 0


def load_ram(snapshot: str) -> bytes:
    data = Path(snapshot).read_bytes()
    return extract_c64mem_ram(data, parse_modules(data))


def cmd_dict(args: argparse.Namespace) -> int:
    ram = load_ram(args.snapshot)
    words = iter_candidate_words(ram, args.start, args.end)
    for word in words:
        mode = "inline" if word.inline_code else "shared"
        print(
            f"{word.addr:04x}  {word.name:<16} flags={word.flags:02x} "
            f"link={word.link:04x} cfa={word.cfa_addr:04x} code={word.code_ptr:04x} {mode}"
        )
    print(f"\n{len(words)} candidate words")
    return 0


def cmd_cfa_scan(args: argparse.Namespace) -> int:
    ram = load_ram(args.snapshot)

    hits: list[tuple[int, str, int]] = []
    for addr in range(args.start, min(args.end, len(ram) - 3)):
        code = int.from_bytes(ram[addr : addr + 2], "little")
        for routine, label in KNOWN_SHARED.items():
            if code == routine:
                param = int.from_bytes(ram[addr + 2 : addr + 4], "little")
                hits.append((addr, label, param))
                break

    for addr, label, param in hits:
        print(f"{addr:04x}  {label:<8} param={param:04x}")

    print(f"\n{len(hits)} candidate CFA cells")
    return 0


def cmd_inline_scan(args: argparse.Namespace) -> int:
    ram = load_ram(args.snapshot)

    hits = []
    for addr in range(args.start, min(args.end, len(ram) - 1)):
        code = int.from_bytes(ram[addr : addr + 2], "little")
        if code == addr + 2:
            hits.append((addr, code))

    for addr, code in hits:
        print(f"{addr:04x}  INLINE   code={code:04x}")

    print(f"\n{len(hits)} inline CFA cells")
    return 0


def classify_cfa(ram: bytes, token: int) -> str:
    return describe_token(ram, token).display


def describe_token(ram: bytes, token: int) -> TokenInfo:
    if not (0 <= token < len(ram) - 1):
        return TokenInfo(token, 0, "out-of-range", "out-of-range")

    if token in KNOWN_PRIMITIVES:
        return TokenInfo(token, token + 2, "primitive", KNOWN_PRIMITIVES[token])

    code = int.from_bytes(ram[token : token + 2], "little")
    if code in KNOWN_SHARED:
        param = int.from_bytes(ram[token + 2 : token + 4], "little")
        return TokenInfo(token, code, KNOWN_SHARED[code], f"{KNOWN_SHARED[code]} param={param:04x}", param)

    if code == token + 2:
        return TokenInfo(token, code, "inline", f"native inline code={code:04x}")

    return TokenInfo(token, code, "raw", f"raw code={code:04x}")


def format_symbol(info: TokenInfo) -> str:
    if info.token in KNOWN_PRIMITIVES:
        return KNOWN_PRIMITIVES[info.token]
    if info.kind == "primitive":
        return info.display
    if info.kind == "DOCOL?":
        if info.token in KNOWN_WORDS:
            return KNOWN_WORDS[info.token]
        return f"WORD_{info.token:04x}"
    if info.kind == "DOCON?":
        assert info.detail is not None
        return f"CONST_{info.token:04x}(${info.detail:04x})"
    if info.kind == "DOVAR?":
        assert info.detail is not None
        return f"VAR_{info.token:04x}(${info.detail:04x})"
    if info.kind == "DOUSER?":
        assert info.detail is not None
        return f"USER_{info.token:04x}(+${info.detail:04x})"
    if info.kind == "DODOES?":
        assert info.detail is not None
        return f"DOES_{info.token:04x}(${info.detail:04x})"
    if info.kind == "inline":
        return f"PRIM_{info.token:04x}"
    return f"CFA_{info.token:04x}"


def cmd_thread_walk(args: argparse.Namespace) -> int:
    ram = load_ram(args.snapshot)

    cfa = args.cfa
    code = int.from_bytes(ram[cfa : cfa + 2], "little")
    print(f"CFA {cfa:04x}: code={code:04x} ({classify_cfa(ram, cfa)})")

    ip = cfa + 2
    index = 0
    while index < args.count:
        token = int.from_bytes(ram[ip : ip + 2], "little")
        label = classify_cfa(ram, token)
        print(f"{index:02d}  {ip:04x}: {token:04x}  {label}")
        ip += 2
        index += 1

        if token == 0x4079 and index < args.count:
            literal = int.from_bytes(ram[ip : ip + 2], "little")
            print(f"{index:02d}  {ip:04x}: {literal:04x}  <literal>")
            ip += 2
            index += 1

    return 0


def cmd_decompile(args: argparse.Namespace) -> int:
    ram = load_ram(args.snapshot)

    cfa = args.cfa
    info = describe_token(ram, cfa)
    if info.kind != "DOCOL?":
        print(f"CFA {cfa:04x} is not a colon word: {info.display}")
        return 1

    ip = cfa + 2
    steps = 0
    labels: set[int] = set()
    listing: list[tuple[int, str]] = []
    labels.add(ip)

    while steps < args.count and ip < len(ram) - 1:
        token_addr = ip
        token = int.from_bytes(ram[ip : ip + 2], "little")
        token_info = describe_token(ram, token)
        ip += 2
        steps += 1

        if token == 0x4079:
            literal = int.from_bytes(ram[ip : ip + 2], "little")
            listing.append((token_addr, f"LIT ${literal:04x}"))
            ip += 2
            continue

        if token == 0x4111:
            offset = int.from_bytes(ram[ip : ip + 2], "little")
            target = (ip + offset) & 0xFFFF
            labels.add(target)
            listing.append((token_addr, f"BRANCH L_{target:04x} ; offset=${offset:04x}"))
            ip += 2
            continue

        if token == 0x4130:
            offset = int.from_bytes(ram[ip : ip + 2], "little")
            target = (ip + offset) & 0xFFFF
            labels.add(target)
            listing.append((token_addr, f"0BRANCH L_{target:04x} ; offset=${offset:04x}"))
            ip += 2
            continue

        listing.append((token_addr, format_symbol(token_info)))
        if token == 0x439F:
            break

    print(f": WORD_{cfa:04x}")
    for addr, text in listing:
        if addr in labels:
            print(f"L_{addr:04x}:")
        print(f"  {text}")
    print(";")
    return 0


def cmd_object(args: argparse.Namespace) -> int:
    ram = load_ram(args.snapshot)

    cfa = args.cfa
    info = describe_token(ram, cfa)
    code = int.from_bytes(ram[cfa : cfa + 2], "little")
    print(f"CFA {cfa:04x}")
    print(f"  kind: {info.kind}")
    print(f"  code: {code:04x}")

    if info.detail is not None:
        print(f"  param: {info.detail:04x}")

    body = ram[cfa + 2 : cfa + 2 + args.bytes]
    print(f"  body: {body.hex(' ')}")

    if info.kind == "DODOES?" and body:
        candidates = []
        if len(body) >= 1:
            candidates.append((0, body[0]))
        if len(body) >= 3:
            candidates.append((2, body[2]))
        for offset, length in candidates:
            text = body[offset + 1 : offset + 1 + length]
            if length and len(text) == length and all(32 <= (b & 0x7F) < 127 for b in text):
                ascii_text = "".join(chr(b & 0x7F) for b in text)
                print(f"  string_length: {length}")
                print(f"  string_text: {ascii_text}")
                break

    return 0


def cmd_xref(args: argparse.Namespace) -> int:
    ram = load_ram(args.snapshot)

    hits: list[int] = []
    end = min(args.end, len(ram) - 1)
    step = 2 if args.aligned else 1
    for addr in range(max(0, args.start), end, step):
        if int.from_bytes(ram[addr : addr + 2], "little") == args.token:
            hits.append(addr)

    info = describe_token(ram, args.token)
    print(f"target {args.token:04x}: {format_symbol(info)}")
    for addr in hits[: args.limit]:
        print(f"{addr:04x}")

    extra = len(hits) - min(len(hits), args.limit)
    if extra > 0:
        print(f"... {extra} more")
    print(f"\n{len(hits)} total references")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect VICE snapshots for the President archaeology task.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    modules_parser = subparsers.add_parser("modules", help="List VICE snapshot modules.")
    modules_parser.add_argument("snapshot", help="Path to a .vsf file.")
    modules_parser.set_defaults(func=cmd_modules)

    dict_parser = subparsers.add_parser("dict", help="Scan RAM for Forth-like dictionary headers.")
    dict_parser.add_argument("snapshot", help="Path to a .vsf file.")
    dict_parser.add_argument("--start", type=lambda s: int(s, 0), default=0x4000, help="Start address, default 0x4000.")
    dict_parser.add_argument("--end", type=lambda s: int(s, 0), default=0x4300, help="End address, default 0x4300.")
    dict_parser.set_defaults(func=cmd_dict)

    cfa_parser = subparsers.add_parser("cfa-scan", help="Scan memory for CFA cells that use known shared runtime routines.")
    cfa_parser.add_argument("snapshot", help="Path to a .vsf file.")
    cfa_parser.add_argument("--start", type=lambda s: int(s, 0), default=0x4300, help="Start address, default 0x4300.")
    cfa_parser.add_argument("--end", type=lambda s: int(s, 0), default=0x7000, help="End address, default 0x7000.")
    cfa_parser.set_defaults(func=cmd_cfa_scan)

    inline_parser = subparsers.add_parser("inline-scan", help="Scan memory for inline native CFA cells.")
    inline_parser.add_argument("snapshot", help="Path to a .vsf file.")
    inline_parser.add_argument("--start", type=lambda s: int(s, 0), default=0x4300, help="Start address, default 0x4300.")
    inline_parser.add_argument("--end", type=lambda s: int(s, 0), default=0x5000, help="End address, default 0x5000.")
    inline_parser.set_defaults(func=cmd_inline_scan)

    walk_parser = subparsers.add_parser("thread-walk", help="Walk a colon word as a list of 16-bit threaded tokens.")
    walk_parser.add_argument("snapshot", help="Path to a .vsf file.")
    walk_parser.add_argument("cfa", type=lambda s: int(s, 0), help="CFA address of a colon word, for example 0x4dac.")
    walk_parser.add_argument("--count", type=int, default=16, help="Number of tokens to print.")
    walk_parser.set_defaults(func=cmd_thread_walk)

    decompile_parser = subparsers.add_parser("decompile", help="Emit a first-pass Forth-like listing for a colon word.")
    decompile_parser.add_argument("snapshot", help="Path to a .vsf file.")
    decompile_parser.add_argument("cfa", type=lambda s: int(s, 0), help="CFA address of a colon word, for example 0x4dac.")
    decompile_parser.add_argument("--count", type=int, default=64, help="Maximum number of threaded steps to decode.")
    decompile_parser.set_defaults(func=cmd_decompile)

    object_parser = subparsers.add_parser("object", help="Inspect a non-colon CFA object, especially DOES>-style string objects.")
    object_parser.add_argument("snapshot", help="Path to a .vsf file.")
    object_parser.add_argument("cfa", type=lambda s: int(s, 0), help="CFA address, for example 0x78d7.")
    object_parser.add_argument("--bytes", type=int, default=32, help="How many body bytes to print.")
    object_parser.set_defaults(func=cmd_object)

    xref_parser = subparsers.add_parser("xref", help="Find RAM references to a 16-bit token or CFA.")
    xref_parser.add_argument("snapshot", help="Path to a .vsf file.")
    xref_parser.add_argument("token", type=lambda s: int(s, 0), help="16-bit value to search for, for example 0x42e3.")
    xref_parser.add_argument("--start", type=lambda s: int(s, 0), default=0x4000, help="Start address, default 0x4000.")
    xref_parser.add_argument("--end", type=lambda s: int(s, 0), default=0x8000, help="End address, default 0x8000.")
    xref_parser.add_argument("--limit", type=int, default=64, help="Maximum number of hits to print.")
    xref_parser.add_argument(
        "--aligned",
        action="store_true",
        help="Scan only even addresses, useful for threaded token streams.",
    )
    xref_parser.set_defaults(func=cmd_xref)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
