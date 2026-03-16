# First-pass decompile examples

These listings come from `tools/president_vsf.py decompile`.

They are intentionally conservative:

- unknown inline primitives are left as `PRIM_xxxx`
- unknown colon words are left as `WORD_xxxx`
- some primitive names still have `?` suffixes where confidence is not yet high

## Startup word `CFA $4dac`

```forth
: WORD_4dac
L_4dae:
  CONST_4ff0($0400)
  VAR_4ff4($3ee8)
  !
  LIT $c307
  DUP
  >R?
  PRIM_5361
  LIT $1100
  R>?
  @+?
  PRIM_42c3
  LIT $0012
  WORD_46f9
  LIT $00fb
  @+?
  LIT $0006
  +?
  LIT $0010
  PRIM_42c3
  LIT $400c
  @+?
  LIT $4d70
  PRIM_5361
  @+?
  PRIM_5361
  !
  WORD_54f5
  WORD_4d76
  EXIT?
;
```

## Small helper word `CFA $46f9`

```forth
: WORD_46f9
L_46fb:
  LIT $4000
  +?
  EXIT?
;
```

## Another startup-adjacent word `CFA $4d76`

```forth
: WORD_4d76
L_4d78:
  PRIM_4386
  WORD_48fd
  DOES_4d6e($4d64)
  WORD_4d28
  0
  USER_4695(+$0016)
  !
  WORD_4cea
  PRIM_4390
  LIT $00fe
  LIT $0328
  C!
  LIT $c800
  LIT $0037
  !
  WORD_c288
  WORD_4d00
  EXIT?
;
```

## Signed multiply helper `CFA $4982`

```forth
: WORD_4982
L_4984:
  2DUP
  XOR
  >R?
  WORD_488d
  SWAP
  WORD_488d
  UM*
  R>?
  WORD_486d
  EXIT?
;
```

This is a good example of why recovering primitive names matters.

With `UM*` in place, the shape becomes much clearer:

- save the combined sign,
- take absolute values,
- do unsigned multiply,
- apply sign fixup at the end.

## Pictured numeric output words

```forth
: <#
  WORD_47c3
  USER_46c9(+$0030)
  !
;

: #
  USER_46b5(+$0026)
  @+?
  UD/MOD?
  ROT
  LIT $0009
  OVER
  <
  0BRANCH L_4849 ; offset=$0008
  LIT $0007
  +
L_4849:
  LIT $0030
  +
  HOLD
;

: #S
L_4855:
  #
  2DUP
  OR
  0=?
  0BRANCH L_4855 ; offset=$fff6
;

: SIGN
  ROT
  PRIM_43ea
  0BRANCH L_4807 ; offset=$0008
  LIT $002d
  HOLD
L_4807:
;

: #>
  DROP
  DROP
  USER_46c9(+$0030)
  @+?
  WORD_47c3
  OVER
  -
;
```

This is almost a museum exhibit by itself: the game appears to carry a proper Forth-style numeric formatting pipeline in threaded form.
