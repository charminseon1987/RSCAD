---
citekey: "{{citekey}}"
title: "{{title | replace('"', "'")}}"
authors: "{{authors}}"
venue: "{{publicationTitle or proceedingsTitle or conferenceName}}"
year: {{date | format("YYYY")}}
volume: "{{volume}}"
issue: "{{issue}}"
pages: "{{pages}}"
doi: "{{DOI or '미검증'}}"
tags: [paper{% for t in tags %}, {{t.tag | replace(" ", "_")}}{% endfor %}]
status: read
source_depth: fulltext
imported: {{importDate | format("YYYY-MM-DD")}}
---
# {{title}}

> [!abstract] 서지
> {{bibliography}}
> [Zotero에서 열기]({{desktopURI}}){% if pdfZoteroLink %} · {{pdfZoteroLink}}{% endif %}

{% persist "내 정리" %}
## 한 줄 요약
※ 

## 문제
▸ 

## 방법
▸ 

## 결과 (Table/Fig. 번호)
▸ 

## 한계
▸ (저자 인정) 
※ (내 판단) 

## 내 연구와의 연결
※ 해당: 석사(ZEB·PV/BIPV) / 박사(GFM)
※ 가져다 쓸 것: 
※ 반박·차별화: 

## 관련 노트
[[ ]]
{% endpersist %}

---
## Zotero 주석 (재가져오기 시 자동 갱신)
{% for annotation in annotations -%}
{%- set c = annotation.colorCategory -%}
{%- if c == "Red" %}{% set kind = "danger" %}{% set label = "핵심·논쟁" %}
{%- elif c == "Yellow" %}{% set kind = "warning" %}{% set label = "인용 후보" %}
{%- elif c == "Blue" %}{% set kind = "tip" %}{% set label = "방법·수식" %}
{%- elif c == "Purple" %}{% set kind = "question" %}{% set label = "내 의문" %}
{%- else %}{% set kind = "note" %}{% set label = "배경" %}{% endif %}
> [!{{kind}}] {{label}} — p. [{{annotation.pageLabel}}](zotero://open-pdf/library/items/{{annotation.attachment.itemKey}}?page={{annotation.pageLabel}}&annotation={{annotation.id}})
{%- if annotation.annotatedText %}
> ▸ {{annotation.annotatedText | replace("\n", " ")}}
{%- endif %}
{%- if annotation.imageRelativePath %}
> ![[{{annotation.imageRelativePath}}]]
{%- endif %}
{%- if annotation.comment %}
> ※ {{annotation.comment | replace("\n", " ")}}
{%- endif %}

{% endfor %}
{% if notes.length > 0 %}
## Zotero 아이템 노트
{% for note in notes %}
{{note.note}}
{% endfor %}
{% endif %}
