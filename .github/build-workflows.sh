#!/bin/sh

ytt_path=$(which ytt)

enure_ytt () {
    if [ -z "$ytt_path" ] ; then
        mkdir -p ~/.local/bin/
        ytt_path=~/.local/bin/ytt
        if [ ! -f "$ytt_path" ] ; then
            if [[ `uname` == Darwin ]]; then
                binary_type=darwin-amd64
            else
                binary_type=linux-amd64
            fi
            if [ -x "$(command -v wget)" ]; then
                dl_bin="wget -nv -O-"
            else
                dl_bin="curl -s -L"
            fi
            url="https://github.com/vmware-tanzu/carvel-ytt/releases/download/v0.41.1/ytt-${binary_type}"
            echo Not ytt installed. Downloading ${url} into ${ytt_path}
            ${dl_bin} ${url} > ${ytt_path}
            chmod 755 ${ytt_path}
        fi
    fi
}

enure_ytt


script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
libraries=
templates=
for FILE in ${script_dir}/workflow.templates/*.yml; do    # for each *.txt file
    case "${FILE##*/}" in #   if file basename...
        *.lib.yml) libraries="${libraries} -f ${FILE}" ;; # ...ends with .lib.yml, it's a library
        *.yml) templates="${templates} ${FILE}" ;; # ...ends with .yml, it's a template
    esac
done

for template in ${templates}; do
    templatename=$(basename -- "$template")
    echo "Processing $templatename"
    ytt -f ${template} ${libraries} > ${script_dir}/workflows/${templatename}
done
