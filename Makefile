.PHONY: test lint run-local evaluate web-build web-dev clean

test:
	pytest -v

lint:
	ruff check backend scripts
	cd web && npm run build

run-local:
	python3 scripts/run_local

evaluate:
	PYTHONPATH=backend python3 -c "from pv.replay.evaluate import run_evaluation; run_evaluation(output_dir='web/public/mock')"

web-build:
	cd web && npm run build

web-dev:
	cd web && npm run dev

clean:
	rm -rf web/dist .pytest_cache
	find . -type d -name "__pycache__" -exec rm -rf {} +
