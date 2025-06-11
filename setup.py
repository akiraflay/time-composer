from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="time-composer",
    version="1.0.0",
    author="Time Composer Team",
    description="Speech-first AI agent for legal billing narratives",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "flask>=2.3.2",
        "flask-cors>=4.0.0",
        "flask-sqlalchemy>=3.0.5",
        "openai>=1.35.3",
        "click>=8.1.7",
        "rich>=13.7.1",
        "requests>=2.31.0",
        "python-dotenv>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "time-composer=cli.time_composer_cli:cli",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Intended Audience :: Legal Industry",
    ],
)