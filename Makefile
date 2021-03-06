BASENAME=$(shell yq -r '.catalog.name' < dabl-meta.yaml 2> /dev/null || yq r dabl-meta.yaml 'catalog.name')
VERSION=$(shell yq -r '.catalog.version' < dabl-meta.yaml 2> /dev/null || yq r dabl-meta.yaml 'catalog.version')
SUBDEPLOYMENTS=$(shell yq -r '.subdeployments' < dabl-meta.yaml 2> /dev/null | sed 's/\[//g' | sed 's/\]//g' | sed 's/,//g' \
	       || yq r dabl-meta.yaml 'subdeployments' | sed 's/\[//g' | sed 's/\]//g' | sed 's/,//g')

TAG_NAME=${BASENAME}-v${VERSION}
NAME=${BASENAME}-${VERSION}

dar_version := $(shell grep "^version" daml.yaml | sed 's/version: //g')
exberry_adapter_version := $(shell cd exberry_adapter && poetry version | cut -f 2 -d ' ')
trigger_version := $(shell grep "^version" triggers/daml.yaml | sed 's/version: //g')
ui_version := $(shell node -p "require(\"./ui/package.json\").version")


state_dir := .dev
daml_build_log = $(state_dir)/daml_build.log
sandbox_pid := $(state_dir)/sandbox.pid
sandbox_log := $(state_dir)/sandbox.log

trigger_build := triggers/.daml/dist/daml-factoring-triggers-$(trigger_version).dar

exberry_adapter_dir := exberry_adapter/bot.egg-info
adapter_pid := $(state_dir)/adapter.pid
adapter_log := $(state_dir)/adapter.log

matching_engine_pid := $(state_dir)/matching_engine.pid
matching_engine_log := $(state_dir)/matching_engine.log

operator_pid := $(state_dir)/operator.pid
operator_log := $(state_dir)/operator.log

custodian_pid := $(state_dir)/custodian.pid
custodian_log := $(state_dir)/custodian.log

csd_pid := $(state_dir)/csd.pid
csd_log := $(state_dir)/csd.log

broker_pid := $(state_dir)/broker.pid
broker_log := $(state_dir)/broker.log

exchange_pid := $(state_dir)/exchange.pid
exchange_log := $(state_dir)/exchange.log


### DAML server
.PHONY: clean stop_daml_server stop_operator stop_custodian stop_broker stop_csd stop_exchange stop_adapter stop_matching_engine

$(state_dir):
	mkdir $(state_dir)

$(daml_build_log): |$(state_dir)
	daml build > $(daml_build_log)

$(sandbox_pid): |$(daml_build_log)
	daml start > $(sandbox_log) & echo "$$!" > $(sandbox_pid)

start_daml_server: $(sandbox_pid)

stop_daml_server:
	pkill -F $(sandbox_pid); rm -f $(sandbox_pid) $(sandbox_log)


### DA Marketplace Operator Bot

$(trigger_build): $(daml_build_log)
	cd triggers && daml build

.PHONY: clean_triggers
clean_triggers:
	rm $(trigger_build)

$(operator_pid): |$(state_dir) $(trigger_build)
	(daml trigger --dar $(trigger_build) \
	    --trigger-name Factoring.OperatorTrigger:handleOperator \
	    --ledger-host localhost --ledger-port 6865 \
	    --ledger-party Operator > $(operator_log) & echo "$$!" > $(operator_pid))

start_operator: $(operator_pid)

stop_operator:
	pkill -F $(operator_pid); rm -f $(operator_pid) $(operator_log)

### DA Marketplace CSD Bot

$(csd_pid): |$(state_dir) $(trigger_build)
	(daml trigger --dar $(trigger_build) \
	    --trigger-name Factoring.CSDTrigger:handleCSD \
	    --ledger-host localhost --ledger-port 6865 \
	    --ledger-party CSD > $(csd_log) & echo "$$!" > $(csd_pid))

start_csd: $(csd_pid)

stop_csd:
	pkill -F $(csd_pid); rm -f $(csd_pid) $(csd_log)

### DA Marketplace Custodian Bot

$(custodian_pid): |$(state_dir) $(trigger_build)
	(daml trigger --dar $(trigger_build) \
	    --trigger-name CustodianTrigger:handleCustodian \
	    --ledger-host localhost --ledger-port 6865 \
	    --ledger-party Custodian > $(custodian_log) & echo "$$!" > $(custodian_pid))

start_custodian: $(custodian_pid)

stop_custodian:
	pkill -F $(custodian_pid); rm -f $(custodian_pid) $(custodian_log)

### DA Marketplace Broker Bot

$(broker_pid): |$(state_dir) $(trigger_build)
	(daml trigger --dar $(trigger_build) \
	    --trigger-name Factoring.BrokerTrigger:handleBroker \
	    --ledger-host localhost --ledger-port 6865 \
	    --ledger-party Broker > $(broker_log) & echo "$$!" > $(broker_pid))

start_broker: $(broker_pid)

stop_broker:
	pkill -F $(broker_pid); rm -f $(broker_pid) $(broker_log)


### DA Marketplace Exchange Bot

$(exchange_pid): |$(state_dir) $(trigger_build)
	(daml trigger --dar $(trigger_build) \
	    --trigger-name Factoring.ExchangeTrigger:handleExchange \
	    --ledger-host localhost --ledger-port 6865 \
	    --ledger-party Exchange > $(exchange_log) & echo "$$!" > $(exchange_pid))

start_exchange: $(exchange_pid)

stop_exchange:
	pkill -F $(exchange_pid); rm -f $(exchange_pid) $(exchange_log)


### DA Marketplace <> Exberry Adapter
$(exberry_adapter_dir):
	cd exberry_adapter && poetry install && poetry build

$(adapter_pid): |$(state_dir) $(exberry_adapter_dir)
	cd exberry_adapter && (DAML_LEDGER_URL=localhost:6865 poetry run python bot/exberry_adapter_bot.py > ../$(adapter_log) & echo "$$!" > ../$(adapter_pid))

start_adapter: $(adapter_pid)

stop_adapter:
	pkill -F $(adapter_pid); rm -f $(adapter_pid) $(adapter_log)


### DA Marketplace Matching Engine
$(matching_engine_pid): |$(state_dir) $(trigger_build)
	(daml trigger --dar $(trigger_build) \
	    --trigger-name MatchingEngine:handleMatching \
	    --ledger-host localhost --ledger-port 6865 \
	    --ledger-party Exchange > $(matching_engine_log) & echo "$$!" > $(matching_engine_pid))

start_matching_engine: $(matching_engine_pid)

stop_matching_engine:
	pkill -F $(matching_engine_pid); rm -f $(matching_engine_pid) $(matching_engine_log)

start_bots: $(operator_pid) $(broker_pid) $(custodian_pid) $(exchange_pid)

stop_bots: stop_broker stop_custodian stop_exchange stop_operator

target_dir := target

dar := $(target_dir)/daml-factoring-model-$(dar_version).dar
exberry_adapter := $(target_dir)/daml-factoring-exberry-adapter-$(exberry_adapter_version).tar.gz
ui := $(target_dir)/daml-factoring-ui-$(ui_version).zip
dabl_meta := $(target_dir)/dabl-meta.yaml
trigger := $(target_dir)/daml-factoring-triggers-$(trigger_version).dar

$(target_dir):
	mkdir $@

.PHONY: package publish

publish: package
	git tag -f "${TAG_NAME}"
	ghr -replace "${TAG_NAME}" "$(target_dir)/${NAME}.dit"

package: $(trigger) $(dar) $(ui) $(dabl_meta) verify-artifacts
	cd $(target_dir) && zip -j ${NAME}.dit $(shell cd $(target_dir) && echo daml-factoring-*) ../pkg/marketplace.svg dabl-meta.yaml

$(dabl_meta): $(target_dir) dabl-meta.yaml
	cp dabl-meta.yaml $@

$(dar): $(target_dir) $(daml_build_log)
	cp .daml/dist/daml-factoring-$(dar_version).dar $@

$(trigger): $(target_dir) $(trigger_build)
	cp $(trigger_build) $@

$(exberry_adapter): $(target_dir) $(exberry_adapter_dir)
	cp exberry_adapter/dist/bot-$(exberry_adapter_version).tar.gz $@

$(ui):
	daml codegen js .daml/dist/daml-factoring-$(dar_version).dar -o daml.js
	cd ui && yarn install --force --frozen-lockfile
	cd ui && yarn build
	cd ui && zip -r daml-factoring-ui-$(ui_version).zip build
	mv ui/daml-factoring-ui-$(ui_version).zip $@
	rm -r ui/build

.PHONY: clean
clean: clean-ui
	rm -rf $(state_dir) $(trigger) $(trigger_build) $(dar) $(ui) $(dabl_meta) $(target_dir)/${NAME}.dit
# rm -rf $(state_dir) $(exberry_adapter_dir) $(exberry_adapter) $(trigger) $(trigger_build) $(dar) $(ui) $(dabl_meta) $(target_dir)/${NAME}.dit

clean-ui:
	rm -rf $(ui) daml.js ui/node_modules ui/build ui/yarn.lock

verify-artifacts:
	for filename in $(SUBDEPLOYMENTS) ; do \
		test -f $(target_dir)/$$filename || (echo could not find $$filename; exit 1;) \
	done
	test -f $(dabl_meta) || (echo could not find $(dabl_meta); exit 1;) \
