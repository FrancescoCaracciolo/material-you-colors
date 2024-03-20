all: update-po build

build:
	gnome-extensions pack -f \
		./material-you-colors@francescocaracciolo.github.io/ \
		--extra-source=shell \
		--extra-source=blend \
		--extra-source=hct \
		--extra-source=palettes \
		--extra-source=quantize \
		--extra-source=scheme \
		--extra-source=score \
		--extra-source=utils \
		--extra-source=base_presets.js \
		--extra-source=color_mappings.js \
		--extra-source=package.json \
		-o .

install:
	gnome-extensions install -f \
		material-you-colors@francescocaracciolo.github.io.shell-extension.zip

pot:
	mkdir -p material-you-colors@francescocaracciolo.github.io/po
	xgettext --from-code=UTF-8 \
		material-you-colors@francescocaracciolo.github.io/extension.js \
		-o material-you-colors@francescocaracciolo.github.io/po/material-you-colors.pot

update-po: pot
	for po_file in material-you-colors@francescocaracciolo.github.io/po/*.po; do \
		msgmerge --update "$$po_file" material-you-colors@francescocaracciolo.github.io/po/material-you-colors.pot; \
	done
