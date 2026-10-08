import uuid

from django.db import models


class SerpCache(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    engine = models.CharField(max_length=40)
    params = models.JSONField()
    response = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class Investigation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    input_text = models.TextField(blank=True)
    entities = models.JSONField(default=dict)
    evidence = models.JSONField(default=list)
    signals = models.JSONField(default=list)
    score = models.IntegerField(default=0)
    band = models.CharField(max_length=16)
    narrative = models.TextField(blank=True)
    warning_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
