from django.urls import path

from core import views

urlpatterns = [
    path("api/investigate", views.investigate),
    path("api/report/<uuid:pk>", views.report),
    path("api/credits", views.credits),
]
